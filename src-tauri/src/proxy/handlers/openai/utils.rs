use super::*;
use axum::{
    extract::{Json, State}, http::StatusCode, response::{IntoResponse, Response},
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
};
use base64::Engine as _;
use bytes::Bytes;
use serde_json::{json, Value};
use tracing::{debug, error, info, warn};

use crate::proxy::mappers::openai::{
    transform_openai_request, transform_openai_response, OpenAIMessage, OpenAIRequest,
};
use crate::proxy::debug_logger;
use crate::proxy::server::AppState;
use crate::proxy::upstream::client::mask_email;

use crate::proxy::handlers::common::{
    apply_retry_strategy, determine_retry_strategy, should_rotate_account, RetryStrategy,
};
use crate::modules::account;
use crate::proxy::common::client_adapter::CLIENT_ADAPTERS;
use crate::proxy::session_manager::SessionManager;
use axum::http::HeaderMap;
use std::collections::{VecDeque, HashMap};
use tokio::time::Duration;

use uuid::Uuid;
use futures::stream::StreamExt;

use tokio::sync::RwLock as TokioRwLock;
use std::sync::OnceLock;

pub const MAX_RETRY_ATTEMPTS: usize = 3;

pub const CODEX_VISIBLE_THOUGHT_MESSAGE_PREFIX: &str = "msg_thought_";








/// Return true only when a streamed chunk contains an actual error event.
///
/// Responses lifecycle envelopes legitimately contain `"error": null`, and
/// assistant text may also mention the word "error". A substring search would
/// misclassify both as failures and rotate otherwise healthy accounts.

pub fn compact_apply_patch_failure_output(
    output: String,
    seen: &mut std::collections::HashSet<String>,
    distinct_count: &mut usize,
) -> String {
    if !output.contains("apply_patch verification failed")
        && !output.contains("Failed to find expected lines")
        && !output.contains("Failed to find context")
        && !output.contains("Expected update hunk")
    {
        return output;
    }

    let fingerprint = output.lines().take(8).collect::<Vec<_>>().join("\n");
    if !seen.insert(fingerprint) {
        return "[Repeated apply_patch failure omitted: the same error was already provided earlier in this request.]".to_string();
    }

    *distinct_count += 1;
    if *distinct_count > 6 {
        return "[Additional apply_patch failure omitted to avoid a retry loop. Produce a fresh V4A patch from current file contents instead of repeating previous failed patches.]".to_string();
    }

    output
}

pub fn codex_ledger_from_body(
    body: &Value,
) -> (
    Option<crate::proxy::mappers::openai::interaction_ledger::InteractionLedger>,
    VecDeque<String>,
) {
    let ledger = crate::proxy::mappers::openai::interaction_ledger::build_codex_interaction_ledger(
        body.get("input"),
        body.get("instructions").and_then(|v| v.as_str()),
        body.get("session_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("previous_response_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    );

    let mut markers = VecDeque::new();
    if let Some(ledger) = &ledger {
        for step in ledger.turns.iter().flat_map(|turn| turn.steps.iter()) {
            if step.raw_item.get("type").and_then(|v| v.as_str()) != Some("instructions") {
                markers.push_back(
                    crate::proxy::mappers::openai::interaction_ledger::step_marker(step),
                );
            }
        }
    }

    (ledger, markers)
}

pub fn strip_codex_step_markers(content: &str) -> String {
    let mut cleaned = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[codex-turn:")
            && trimmed.contains(" step:")
            && trimmed.contains(" type:")
            && trimmed.ends_with(']')
        {
            continue;
        }
        cleaned.push(line);
    }
    cleaned.join("\n").trim().to_string()
}

pub fn prefix_with_step_marker(_marker: Option<String>, content: String) -> String {
    // Step markers are useful in debug ledgers, but must not be visible to
    // Gemini. If they enter the prompt, the model learns to emit them as text.
    strip_codex_step_markers(&content)
}

pub const APPLY_PATCH_CHAT_PATH_SYSTEM_GUIDANCE_ZH: &str = concat!(
    "[apply_patch chat-path 指引 — 由 codex-app-transfer adapter 注入,因为上游 lark 语法约束在 chat function-call provider 上不可用]\n",
    "\n",
    "**务必使用 `apply_patch` tool 写文件内容** —— 新建文件、单行编辑、整文件重写都一样。**绝不使用 shell `cat <<EOF > file` / `printf '<content>' > file` / `echo '<content>' > file` / 任何 `>` 重定向来写实际文件内容** —— 这样做会绕过 Codex diff UI 和审计 trail。**同样,绝不使用 `sed -i` / `perl -i` / `ed`、或 shell 按行号删除(如 `sed -i 'N,Md' file`)来编辑或删除已有文件内容** —— 就地 shell 编辑器绕过 diff UI,且对多次编辑间的行号漂移很脆弱(按过期行号删会切错、损坏文件)。(新建或空文件用 `*** Add File: <path>` —— 不要用 shell 重定向。)**优先外科式针对性编辑**:要改/替换已有内容时,只发改动那几行的 `-`(旧)和 `+`(新),保持每个 hunk 最小;且**不要**把增删空行作为编辑的一部分,除非空行本身就是改动(空行 `+`/`-` 位置歧义、可能静默 apply 失败)。**删除内容 —— 即便是跨很多行的大段连续块 —— 也用 apply_patch hunk 里的 `-` 行表达,或用 `*** Delete File: <path>` 删整个文件;不要因为块大就改用 `sed`/`python` 按行范围删除。** 对同一文件的多处不相邻编辑可以放进**一次** apply_patch 调用、分成多个 hunk。**不要**整段重新生成再追加,**不要**因为改了一部分就整文件重写。整文件替换(同一 patch 内 `*** Delete File: <path>` + `*** Add File: <path>`、每行前缀 `+`)**仅限**真正需要时:新建全新内容,或几乎每行都不同。\n",
    "\n",
    "调用 `apply_patch` tool 时,遵循以下基于非 OpenAI chat provider 实战观察总结的规则:\n",
    "\n",
    "1. 推荐的 Update File 形式是**最简形态**:仅 `-line`(要删的行,byte-exact)和 `+line`(新行)直接跟在 `*** Update File: <path>` 之后 —— 无 `@@`、无 context 行。",
    "凡是 `-` 行在文件里**唯一**时(简单单行编辑、配置改动、function 签名等绝大多数场景皆是)就用这个形态。例:\n",
    "  *** Update File: src/config.py\n",
    "  -DEBUG = False\n",
    "  +DEBUG = True\n",
    "若 `-` 行单独**有歧义**(同一行文本在文件多处出现),在上方/下方加空格前缀的 context 行(` line`)钉住它。",
    "若 context 行也不足以消歧,再在独立行上加**单端** `@@ <header>` 标记(`@@ class Foo`、`@@ def bar():`、`@@ fn main() {`)。",
    "**绝不加尾随 `@@`**(`@@ <header> @@` 是错的)—— Codex Desktop 的 V4A applier 会把尾随 `@@` 当字面文本,报 `Failed to find context '... @@'`。",
    "深层嵌套消歧时用**多个** `@@` 行各占一行(例如 `@@ class Outer\\n@@ def inner():`),每条都是单端。\n",
    "\n",
    "2. Add File **不用** `@@` 标记、**不用** hunk。`*** Add File: <path>` 之后,新文件**每一行内容**(包括空行,写成单个 `+` 占一行)都前缀 `+`。没 `+` 前缀的原始源码(例如直接写 `def main():`)会触发 `'def main():' is not a valid hunk header` 错误。",
    "但结构标记 `*** Begin Patch` / `*** Add File:` / `*** End Patch` **不是内容,不加前缀**。尤其**绝不给终止符加前缀**(`+*** End Patch` 是错的):带 `+` 的终止符会被当成内容行,在新建文件末尾留下一行字面 `*** End Patch`。\n",
    "\n",
    "3. 每个 `-` 行和空格前缀的 context 行**必须**跟文件 byte-for-byte 一致(同样的前导 whitespace,不能 trim 尾随空格,字符完全相同)。不确定时先用 shell 跑 `cat <path>` 或 `sed -n '1,80p' <path>` 查一下,再用真实字节组 patch。靠猜会触发 `Failed to find context '<your guess>'` 错误。\n",
    "\n",
    "3a. 行前缀是**单字符**,前缀和内容之间**没有空格**:写 `-DEBUG = False`(不是 `- DEBUG = False`)、`+DEBUG = True`(不是 `+ DEBUG = True`),context 行 ` keepme`(单个前导空格)。Codex Desktop V4A applier 可能容忍多余空格,但其它 apply_patch 实现严格 —— 前缀写紧凑。\n",
    "\n",
    "4. **不要**在同一 patch 内对同一路径同时用 `*** Add File: <path>` 和 `*** Update File: <path>`。Update 步骤会在 Add 步骤落盘前读文件,看到空文件后失败。要么 (a) 让 `*** Add File:` 一次性写最终内容,要么 (b) 拆成两个独立的 `apply_patch` 调用。\n",
    "\n",
    "5. 新建或空文件用 `*** Add File: <path>`、每行前缀 `+`(不要用 `*** Update File:`,也不要用 shell 重定向)。\n",
    "\n",
    "6. 多行文件里,**没有**对应 `-` 行的孤立 `+` 行会**追加**在上文 context 之下 —— **不会**替换任何已有行。要修改已有行,**必须**同时包含 `-` 行(删旧内容)和 `+` 行(加新内容)。",
    "空格前缀的 context 行是拿来**跟文件匹配**的、绝不新增 —— 它必须已存在于文件中。要引入全新行,前缀 `+`;把文件里还没有的行写成 context(或不加前缀)会得到一个无实际改动、apply 失败或 `Failed to find context` 的 hunk。\n",
    "\n",
    "7. Update 报 `Failed to find context` 时,说明 `-`/context 行跟文件 byte 对不上 —— 重新 `cat <path>` / `sed -n` 读文件、把这些行改成完全一致,再重试**同一个**针对性 Update。**不要**升级成整文件重写/重新追加,把编辑保持在改动的那几行。",
    "在**一次**回合里对**同一文件**做多处编辑时,每个已应用的 hunk 都会改变文件内容 —— 把相关编辑放进**一个** patch 的多个 hunk,或在多次独立调用之间重新读文件。某个 `-` 行不再匹配,可能是它**已经被删掉**(被前一个 hunk、或本回合更早的编辑)—— 重发同一删除前先确认它还在,别盲目重试。\n",
    "\n",
    "8. `*** Begin Patch` **必须**是 `input` 字符串的字面第一行 —— 不能有前导空格,前面不能有其它内容,绝不能直接写 `*** Add File:` 或任何操作 header。漏了会触发 `invalid patch: The first line of the patch must be '*** Begin Patch'`。\n",
    "\n",
    "9. `*** Update File: <old>` + `*** Move to: <new>` **要求**至少一个 hunk(带 `-`/`+` 行或 `*** End of File` 标记)。空的 Update+Move 块会报 `Update file hunk for path '<old>' is empty`。**纯重命名不改内容**时,在同一 patch 内用 `*** Delete File: <old>` + `*** Add File: <new>`(把原内容每行前缀 `+` 复制过去)。**重命名同时改内容**时,保留 Update+Move 并写真实的 `-`/`+` hunk。\n",
    "\n",
    "10. 编辑 memory 文件(如 `~/.codex/memories/MEMORY.md`)要格外小心:并发进程可能在你上次读它、到你的 patch 落地之间重写该文件。打 patch **前立即** `cat` 该文件,让每个 `-`/context 行都是**当前**文件里存在的行,并用最小唯一锚点(如单个 `@@ <section header>` + 只写你实际改的那几行)。过期的 `-` 行 —— 内容已被并发固化(consolidation)改掉 —— 会报 `Failed to find context`;失败时重新读、按当前字节重建,而不是重试过期 patch。\n",
    "\n",
    "遵循这些规则可以避免 retry 风暴,提升首次尝试的成功率。"
);

pub const WEB_TOOLS_SYSTEM_GUIDANCE_ZH: &str = "联网获取信息时(实时事实 / 价格 / 文档 / 新闻 / 版本号 / 任何你不确定或可能已过时的内容),**优先用 `web_search` 和 `web_fetch` 工具,不要用 shell 的 curl / wget / python 去抓 URL 或搜索引擎**。本机对外网访问受限,shell 直连通常被防火墙 / 反爬拦截(返回空或 403),会白费多轮尝试、最后只能靠可能过时的记忆作答;而这两个工具经代理(浏览器 TLS 指纹 + headless 渲染)能真正抓到。用法:先 `web_search(query)` 找信息源,再用 `web_fetch(url)` 读该页**完整正文**(返回全文、自己读)。之前抓过的某 URL 若在对话历史里被折叠 / 压缩、需要回看完整原文, 用 `read_url_local(url)` 从本地缓存取回, 不必重新联网。";

pub const CHINESE_LANGUAGE_DIRECTIVE: &str =
    "**请始终使用简体中文回复用户**(代码、命令、标识符、文件路径等技术内容保持原文,不要翻译)。";

pub static WEBSOCKET_TOOL_CALL_CACHE: OnceLock<TokioRwLock<HashMap<String, Value>>> = OnceLock::new();

pub fn get_cached_tool_call(call_id: &str) -> Option<Value> {
    if let Some(cache) = WEBSOCKET_TOOL_CALL_CACHE.get() {
        if let Ok(guard) = cache.try_read() {
            return guard.get(call_id).cloned();
        }
    }

    None
}

pub fn insert_cached_tool_call(call_id: String, item: Value) {
    if call_id.is_empty() {
        return;
    }

    let cache = WEBSOCKET_TOOL_CALL_CACHE.get_or_init(|| TokioRwLock::new(HashMap::new()));

    if let Ok(mut guard) = cache.try_write() {
        guard.insert(call_id, item);
    }
}

pub const INTERNAL_BACKGROUND_TASK: &str = "gemini-2.5-flash-lite";

pub const CONTEXT_SUMMARY_PROMPT: &str = r#"You are a context compression specialist. Your task is to create a structured XML snapshot of the conversation history.

This snapshot will become the Agent's ONLY memory of the past. All key details, plans, errors, and user instructions MUST be preserved.

First, think through the entire history in a private <scratchpad>. Review the user's overall goal, the agent's actions, tool outputs, file modifications, and any unresolved issues. Identify every piece of information critical for future actions.

After reasoning, generate the final <state_snapshot> XML object. Information must be extremely dense. Omit any irrelevant conversational filler.

The structure MUST be as follows:

<state_snapshot>
  <overall_goal>
    <!-- Describe the user's high-level goal in one concise sentence -->
  </overall_goal>

  <technical_context>
    <!-- Tech stack: frameworks, languages, toolchain, dependency versions -->
  </technical_context>

  <file_system_state>
    <!-- List files that were created, read, modified, or deleted. Note their status -->
  </file_system_state>

  <code_changes>
    <!-- Key code snippets (preserve function signatures and important logic) -->
  </code_changes>

  <debugging_history>
    <!-- List all errors encountered, with stack traces, and how they were fixed -->
  </debugging_history>

  <current_plan>
    <!-- Step-by-step plan. Mark completed steps -->
  </current_plan>

  <user_preferences>
    <!-- User's work preferences for this project (test commands, code style, etc.) -->
  </user_preferences>

  <key_decisions>
    <!-- Critical architectural decisions and design choices -->
  </key_decisions>

  <latest_thinking_signature>
    <!-- [CRITICAL] Preserve the last valid thinking signature -->
    <!-- Format: base64-encoded signature string -->
    <!-- This MUST be copied exactly as-is, no modifications -->
  </latest_thinking_signature>
</state_snapshot>

**IMPORTANT**:
1. Code snippets must be complete, including function signatures and key logic
2. Error messages must be preserved verbatim, including line numbers and stacks
3. File paths must use absolute paths
4. The thinking signature must be copied exactly, no modifications
"#;

