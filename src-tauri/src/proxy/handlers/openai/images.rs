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

pub async fn handle_images_generations(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    match handle_images_generations_internal(state, body).await {
        Ok((email_header, openai_response)) => Ok((
            StatusCode::OK,
            [("X-Account-Email", email_header.as_str())],
            Json(openai_response),
        )
            .into_response()),
        // Attach the attempted account to error responses too, so the traffic log shows
        // which account the failed (e.g. 502/503) image request used.
        Err((status, msg, email_opt)) => {
            let email = email_opt.unwrap_or_default();
            Ok((status, [("X-Account-Email", email)], msg).into_response())
        }
    }
}

pub async fn handle_images_generations_internal(
    state: AppState,
    body: Value,
) -> Result<(String, Value), (StatusCode, String, Option<String>)> {
    // 1. 解析请求参数
    let prompt = body.get("prompt").and_then(|v| v.as_str()).ok_or((
        StatusCode::BAD_REQUEST,
        "Missing 'prompt' field".to_string(),
        None,
    ))?;

    let model = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini-3.1-flash-image");

    let n = body.get("n").and_then(|v| v.as_u64()).unwrap_or(1) as usize;

    let size = body.get("size").and_then(|v| v.as_str());

    let response_format = body
        .get("response_format")
        .and_then(|v| v.as_str())
        .unwrap_or("b64_json");

    let quality = body.get("quality").and_then(|v| v.as_str());

    let image_size = body
        .get("image_size")
        .or(body.get("imageSize"))
        .and_then(|v| v.as_str());

    let style = body
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("vivid");

    info!(
        "[Images] Received request: model={}, prompt={:.50}..., n={}, size={}, quality={}, style={}",
        model,
        prompt,
        n,
        size.unwrap_or("auto"),
        quality.unwrap_or("auto"),
        style
    );

    // 2. 使用 common_utils 解析图片配置（统一逻辑，支持动态计算宽高比和 quality 映射）
    let (image_config, clean_model_name) =
        crate::proxy::mappers::common_utils::parse_image_config_with_params(
            model, size, quality, image_size,
        );

    // 3. Prompt Enhancement（保留原有逻辑）
    let mut final_prompt = prompt.to_string();
    if quality == Some("hd") {
        final_prompt.push_str(", (high quality, highly detailed, 4k resolution, hdr)");
    }
    match style {
        "vivid" => final_prompt.push_str(", (vivid colors, dramatic lighting, rich details)"),
        "natural" => final_prompt.push_str(", (natural lighting, realistic, photorealistic)"),
        _ => {}
    }

    // 4. 并发发送请求
    // 注意：不再在外部获取 Token，而是移入 Task 内部并在重试时获取
    let upstream = state.upstream.clone();
    let token_manager = state.token_manager.clone();
    let max_pool_size = token_manager.len();
    let max_attempts = MAX_RETRY_ATTEMPTS
        .min(max_pool_size.saturating_add(1))
        .max(2);

    let mut tasks = Vec::new();

    // Track the last account actually attempted, so error responses (502/503) can be
    // attributed to an account in the traffic log instead of showing "(none)".
    let attempted_account = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));

    for _ in 0..n {
        let upstream = upstream.clone();
        let token_manager = token_manager.clone();
        let final_prompt = final_prompt.clone();
        let image_config = image_config.clone(); // 使用解析后的完整配置
        let _response_format = response_format.to_string();

        let model_to_use = clean_model_name.clone();
        let attempted_account = attempted_account.clone();

        tasks.push(tokio::spawn(async move {
            let mut last_error = String::new();
            let mut force_rotate = false;

            for attempt in 0..max_attempts {
                let (access_token, project_id, email, account_id, _wait_ms) = match token_manager
                    .get_token("image_gen", force_rotate, None, &model_to_use)
                    .await
                {
                    Ok(t) => t,
                    Err(e) => {
                        last_error = format!("Token error: {}", e);
                        if attempt < max_attempts - 1 {
                            tokio::time::sleep(Duration::from_millis(500)).await;
                            continue;
                        }
                        break;
                    }
                };
                if let Ok(mut g) = attempted_account.lock() {
                    *g = Some(email.clone());
                }

                // [FIX] Resolve to the account-specific dynamic image model, exactly like the
                // chat (openai.rs:232) and gemini (gemini.rs:155) handlers do. Sending the static
                // alias (e.g. "gemini-3-pro-image") made upstream return 404 "Requested entity was
                // not found" because each account exposes its own concrete image model id.
                let resolved_model = token_manager
                    .resolve_dynamic_model_for_account(&account_id, &model_to_use)
                    .await;

                let gemini_body = json!({
                    "project": project_id,
                    "requestId": format!("agent-{}", uuid::Uuid::new_v4()),
                    "model": resolved_model,
                    "userAgent": "antigravity",
                    "requestType": "image_gen",
                    "request": {
                        "contents": [{
                            "role": "user",
                            "parts": [{"text": final_prompt}]
                        }],
                        "generationConfig": {
                            "candidateCount": 1, // 强制单张
                            "imageConfig": image_config // ✅ 使用完整配置（包含 aspectRatio 和 imageSize）
                        },
                        "safetySettings": [
                            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF" },
                        ]
                    }
                });

                match upstream
                    .call_v1_internal(
                        "generateContent",
                        &access_token,
                        gemini_body,
                        None,
                        Some(account_id.as_str()),
                    )
                    .await
                {
                    Ok(call_result) => {
                        let response = call_result.response;
                        let status = response.status();
                        if !status.is_success() {
                            let err_text = response.text().await.unwrap_or_default();
                            let status_code = status.as_u16();
                            last_error = format!("Upstream error {}: {}", status, err_text);

                            // 429/500/503: mark limited and rotate to another account
                            if status_code == 429 || status_code == 503 || status_code == 500 {
                                tracing::warn!(
                                    "[Images] Account {} rate limited/error ({}), rotating...",
                                    email,
                                    status_code
                                );
                                token_manager
                                    .mark_rate_limited_async(
                                        &email,
                                        status_code,
                                        None,
                                        &err_text,
                                        Some(model_to_use.as_str()),
                                    )
                                    .await;
                                force_rotate = true;
                                continue; // Retry loop
                            }

                            // [FIX] 403/404 usually mean THIS account lacks the image model or
                            // project access. Rotate to another account instead of failing the
                            // whole request, so an image-capable account can serve it.
                            if (status_code == 403 || status_code == 404)
                                && attempt < max_attempts - 1
                            {
                                tracing::warn!(
                                    "[Images] Account {} returned {} for image gen, rotating to another account",
                                    email,
                                    status_code
                                );
                                force_rotate = true;
                                continue;
                            }

                            // Other errors: return
                            return Err(last_error);
                        }
                        token_manager.mark_account_success(&account_id);
                        token_manager
                            .clear_persisted_live_limit(&account_id, Some(&model_to_use))
                            .await;

                        match response.json::<Value>().await {
                            Ok(json) => return Ok((json, email)),
                            Err(e) => return Err(format!("Parse error: {}", e)),
                        }
                    }
                    Err(e) => {
                        last_error = format!("Network error: {}", e);
                        continue;
                    }
                }
            }

            // All attempts failed
            Err(format!("Max retries exhausted. Last error: {}", last_error))
        }));
    }

    // 5. 收集结果
    let mut images: Vec<Value> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut used_email: Option<String> = None;

    for (idx, task) in tasks.into_iter().enumerate() {
        match task.await {
            Ok(result) => match result {
                Ok((gemini_resp, email_used)) => {
                    // Capture the email from the first successful task for logging
                    if used_email.is_none() {
                        used_email = Some(email_used);
                    }
                    let raw = gemini_resp.get("response").unwrap_or(&gemini_resp);
                    if let Some(parts) = raw
                        .get("candidates")
                        .and_then(|c| c.get(0))
                        .and_then(|cand| cand.get("content"))
                        .and_then(|content| content.get("parts"))
                        .and_then(|p| p.as_array())
                    {
                        for part in parts {
                            if let Some(img) = part.get("inlineData") {
                                let data = img.get("data").and_then(|v| v.as_str()).unwrap_or("");
                                if !data.is_empty() {
                                    if response_format == "url" {
                                        let mime_type = img
                                            .get("mimeType")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("image/png");
                                        images.push(json!({
                                            "url": format!("data:{};base64,{}", mime_type, data)
                                        }));
                                    } else {
                                        images.push(json!({
                                            "b64_json": data
                                        }));
                                    }
                                    tracing::debug!("[Images] Task {} succeeded", idx);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("[Images] Task {} failed: {}", idx, e);
                    errors.push(e);
                }
            },
            Err(e) => {
                let err_msg = format!("Task join error: {}", e);
                tracing::error!("[Images] Task {} join error: {}", idx, e);
                errors.push(err_msg);
            }
        }
    }

    if images.is_empty() {
        let error_msg = if !errors.is_empty() {
            errors.join("; ")
        } else {
            "No images generated".to_string()
        };
        tracing::error!("[Images] All {} requests failed. Errors: {}", n, error_msg);

        // [FIX] Map upstream status codes correctly instead of forcing 502
        let status = if error_msg.contains("429") || error_msg.contains("Quota exhausted") {
            StatusCode::TOO_MANY_REQUESTS
        } else if error_msg.contains("503") || error_msg.contains("Service Unavailable") {
            StatusCode::SERVICE_UNAVAILABLE
        } else {
            StatusCode::BAD_GATEWAY
        };

        let attempted = used_email
            .clone()
            .or_else(|| attempted_account.lock().ok().and_then(|g| g.clone()));
        return Err((status, error_msg, attempted));
    }

    // 部分成功时记录警告
    if !errors.is_empty() {
        tracing::warn!(
            "[Images] Partial success: {} out of {} requests succeeded. Errors: {}",
            images.len(),
            n,
            errors.join("; ")
        );
    }

    tracing::info!(
        "[Images] Successfully generated {} out of {} requested image(s)",
        images.len(),
        n
    );

    // 6. 构建 OpenAI 格式响应
    let openai_response = json!({
        "created": chrono::Utc::now().timestamp(),
        "data": images
    });

    // [FIX] 图像生成成功后触发配额刷新 (Issue #1995)
    tokio::spawn(async move {
        let _ = account::refresh_all_quotas_logic().await;
    });

    let email_header = used_email.unwrap_or_default();
    Ok((email_header, openai_response))
}

pub async fn handle_images_edits(
    State(state): State<AppState>,
    mut multipart: axum::extract::Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tracing::info!("[Images] Received edit request");

    let mut image_data: Option<(String, String)> = None;
    let mut mask_data: Option<(String, String)> = None;
    let mut reference_images: Vec<(String, String)> = Vec::new(); // Store (base64 data, mime type) reference images
    let mut prompt = String::new();
    let mut n = 1;
    let mut size = "1024x1024".to_string();
    let mut response_format = "b64_json".to_string();
    let mut model = "gemini-3.1-flash-image".to_string();
    let mut aspect_ratio: Option<String> = None;
    let mut image_size_param: Option<String> = None;
    let mut style: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Multipart error: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "image" {
            let mime_type = field
                .content_type()
                .map(|content_type| content_type.to_string())
                .unwrap_or_else(|| "image/png".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Image read error: {}", e)))?;
            image_data = Some((
                base64::engine::general_purpose::STANDARD.encode(data),
                mime_type,
            ));
        } else if name == "mask" {
            let mime_type = field
                .content_type()
                .map(|content_type| content_type.to_string())
                .unwrap_or_else(|| "image/png".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Mask read error: {}", e)))?;
            mask_data = Some((
                base64::engine::general_purpose::STANDARD.encode(data),
                mime_type,
            ));
        } else if name.starts_with("image") && name != "image_size" {
            // Support image1, image2, etc.
            let mime_type = field
                .content_type()
                .map(|content_type| content_type.to_string())
                .unwrap_or_else(|| "image/jpeg".to_string());
            let data = field.bytes().await.map_err(|e| {
                (
                    StatusCode::BAD_REQUEST,
                    format!("Reference image read error: {}", e),
                )
            })?;
            reference_images.push((
                base64::engine::general_purpose::STANDARD.encode(data),
                mime_type,
            ));
        } else if name == "prompt" {
            prompt = field
                .text()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Prompt read error: {}", e)))?;
        } else if name == "n" {
            if let Ok(val) = field.text().await {
                n = val.parse().unwrap_or(1);
            }
        } else if name == "size" {
            if let Ok(val) = field.text().await {
                size = val;
            }
        } else if name == "image_size" {
            if let Ok(val) = field.text().await {
                image_size_param = Some(val);
            }
        } else if name == "aspect_ratio" {
            if let Ok(val) = field.text().await {
                aspect_ratio = Some(val);
            }
        } else if name == "style" {
            if let Ok(val) = field.text().await {
                style = Some(val);
            }
        } else if name == "response_format" {
            if let Ok(val) = field.text().await {
                response_format = val;
            }
        } else if name == "model" {
            if let Ok(val) = field.text().await {
                if !val.is_empty() {
                    model = val;
                }
            }
        }
    }

    // Validation: Require either 'image' (standard edit) OR 'prompt' (generation)
    // If reference images are present, we treat it as generation with image context
    if prompt.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Missing prompt".to_string()));
    }

    tracing::info!(
        "[Images] Edit/Ref Request: model={}, prompt={}, n={}, size={}, aspect_ratio={:?}, image_size={:?}, style={:?}, refs={}, has_main_image={}",
        model,
        prompt,
        n,
        size,
        aspect_ratio,
        image_size_param,
        style,
        reference_images.len(),
        image_data.is_some()
    );

    // 2. Prepare Config (Aspect Ratio / Size)
    // Priority: aspect_ratio param > size param
    // Priority: image_size param > quality param (derived from model suffix or default)

    // We reuse parse_image_config_with_params but need to adapt the inputs
    let size_input = aspect_ratio.as_deref().or(Some(&size)); // If aspect_ratio is "16:9", it works. If it's just "1:1", it also works.

    // Map 'image_size' (2K) to 'quality' semantics if needed, or pass directly if logic supports
    // common_utils logic: 'hd' -> 4K, 'medium' -> 2K.
    let quality_input = match image_size_param.as_deref() {
        Some("4K") => Some("hd"),
        Some("2K") => Some("medium"),
        _ => None, // Fallback to standard
    };

    let (image_config, clean_model_name) =
        crate::proxy::mappers::common_utils::parse_image_config_with_params(
            &model,
            size_input,
            quality_input,
            image_size_param.as_deref(), // [NEW] Pass direct image_size param
        );

    // 3. Construct Contents
    let mut contents_parts = Vec::new();

    // Add Prompt
    let mut final_prompt = prompt.clone();
    if let Some(s) = style {
        final_prompt.push_str(&format!(", style: {}", s));
    }
    contents_parts.push(json!({
        "text": final_prompt
    }));

    // Add Main Image (if standard edit)
    if let Some((data, mime_type)) = image_data {
        contents_parts.push(json!({
            "inlineData": {
                "mimeType": mime_type,
                "data": data
            }
        }));
    }

    // Add Mask (if standard edit)
    if let Some((data, mime_type)) = mask_data {
        contents_parts.push(json!({
            "inlineData": {
                "mimeType": mime_type,
                "data": data
            }
        }));
    }

    // Add Reference Images (Image-to-Image)
    for (ref_data, mime_type) in reference_images {
        contents_parts.push(json!({
            "inlineData": {
                "mimeType": mime_type,
                "data": ref_data
            }
        }));
    }

    // 4. 并发发送请求
    // 注意：不再在外部获取 Token，而是移入 Task 内部
    let upstream = state.upstream.clone();
    let token_manager = state.token_manager.clone();
    let max_pool_size = token_manager.len();
    let max_attempts = MAX_RETRY_ATTEMPTS
        .min(max_pool_size.saturating_add(1))
        .max(2);

    let mut tasks = Vec::new();
    for _ in 0..n {
        let upstream = upstream.clone();
        let token_manager = token_manager.clone();
        let contents_parts = contents_parts.clone();
        let image_config = image_config.clone();
        let response_format = response_format.clone();
        let model_to_use = clean_model_name.clone();

        tasks.push(tokio::spawn(async move {
            let mut last_error = String::new();

            let mut force_rotate = false;

            for attempt in 0..max_attempts {
                // 4.1 获取 Token
                let (access_token, project_id, email, account_id, _wait_ms) = match token_manager
                    .get_token("image_gen", force_rotate, None, "gemini-3-pro-image")
                    .await
                {
                    Ok(t) => t,
                    Err(e) => {
                        last_error = format!("Token error: {}", e);
                        if attempt < max_attempts - 1 {
                            tokio::time::sleep(Duration::from_millis(500)).await;
                            continue;
                        }
                        break;
                    }
                };

                // 4.2 Construct Request Body (Need project_id)
                let gemini_body = json!({
                    "project": project_id,
                    "requestId": format!("img-edit-{}", uuid::Uuid::new_v4()),
                    "model": model_to_use,
                    "userAgent": "antigravity",
                    "requestType": "image_gen",
                    "request": {
                        "contents": [{
                            "role": "user",
                            "parts": contents_parts
                        }],
                        "generationConfig": {
                            "candidateCount": 1,
                            "imageConfig": image_config,
                            "maxOutputTokens": 8192,
                            "stopSequences": [],
                            "temperature": 1.0,
                            "topP": 0.95,
                            "topK": 40
                        },
                        "safetySettings": [
                            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF" },
                            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF" },
                        ]
                    }
                });

                match upstream
                    .call_v1_internal(
                        "generateContent",
                        &access_token,
                        gemini_body,
                        None,
                        Some(account_id.as_str()),
                    )
                    .await
                {
                    Ok(call_result) => {
                        let response = call_result.response;
                        let status = response.status();
                        if !status.is_success() {
                            let err_text = response.text().await.unwrap_or_default();
                            let status_code = status.as_u16();
                            last_error = format!("Upstream error {}: {}", status, err_text);

                            // 429/500/503 等错误进行标记和重试
                            if status_code == 429 || status_code == 503 || status_code == 500 {
                                tracing::warn!(
                                    "[Images] Account {} rate limited/error ({}), rotating...",
                                    email,
                                    status_code
                                );
                                token_manager
                                    .mark_rate_limited_async(
                                        &email,
                                        status_code,
                                        None,
                                        &err_text,
                                        Some(&model_to_use),
                                    )
                                    .await;
                                continue; // Retry loop
                            }
                            return Err(last_error);
                        }
                        token_manager.mark_account_success(&account_id);
                        token_manager
                            .clear_persisted_live_limit(&account_id, Some(&model_to_use))
                            .await;

                        match response.json::<Value>().await {
                            Ok(json) => return Ok((json, response_format.clone(), email)),
                            Err(e) => return Err(format!("Parse error: {}", e)),
                        }
                    }
                    Err(e) => {
                        last_error = format!("Network error: {}", e);
                        continue;
                    }
                }
            }
            Err(format!("Max retries exhausted. Last error: {}", last_error))
        }));
    }

    // 5. Collect Results
    let mut images: Vec<Value> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut used_email: Option<String> = None;

    for (idx, task) in tasks.into_iter().enumerate() {
        match task.await {
            Ok(result) => match result {
                Ok((gemini_resp, response_format, email_used)) => {
                    if used_email.is_none() {
                        used_email = Some(email_used);
                    }
                    let raw = gemini_resp.get("response").unwrap_or(&gemini_resp);
                    if let Some(parts) = raw
                        .get("candidates")
                        .and_then(|c| c.get(0))
                        .and_then(|cand| cand.get("content"))
                        .and_then(|content| content.get("parts"))
                        .and_then(|p| p.as_array())
                    {
                        for part in parts {
                            if let Some(img) = part.get("inlineData") {
                                let data = img.get("data").and_then(|v| v.as_str()).unwrap_or("");
                                if !data.is_empty() {
                                    if response_format == "url" {
                                        let mime_type = img
                                            .get("mimeType")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("image/png");
                                        images.push(json!({
                                            "url": format!("data:{};base64,{}", mime_type, data)
                                        }));
                                    } else {
                                        images.push(json!({
                                            "b64_json": data
                                        }));
                                    }
                                    tracing::debug!("[Images] Task {} succeeded", idx);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("[Images] Task {} failed: {}", idx, e);
                    errors.push(e);
                }
            },
            Err(e) => {
                let err_msg = format!("Task join error: {}", e);
                tracing::error!("[Images] Task {} join error: {}", idx, e);
                errors.push(err_msg);
            }
        }
    }

    if images.is_empty() {
        let error_msg = if !errors.is_empty() {
            errors.join("; ")
        } else {
            "No images generated".to_string()
        };
        tracing::error!(
            "[Images] All {} edit requests failed. Errors: {}",
            n,
            error_msg
        );
        let status = if error_msg.contains("429") || error_msg.contains("Quota exhausted") {
            StatusCode::TOO_MANY_REQUESTS
        } else if error_msg.contains("503") || error_msg.contains("Service Unavailable") {
            StatusCode::SERVICE_UNAVAILABLE
        } else {
            StatusCode::BAD_GATEWAY
        };

        return Err((status, error_msg));
    }

    if !errors.is_empty() {
        tracing::warn!(
            "[Images] Partial success: {} out of {} requests succeeded. Errors: {}",
            images.len(),
            n,
            errors.join("; ")
        );
    }

    tracing::info!(
        "[Images] Successfully generated {} out of {} requested edited image(s)",
        images.len(),
        n
    );

    let openai_response = json!({
        "created": chrono::Utc::now().timestamp(),
        "data": images
    });

    tokio::spawn(async move {
        let _ = account::refresh_all_quotas_logic().await;
    });

    let email_header = used_email.unwrap_or_default();
    Ok((
        StatusCode::OK,
        [
            ("X-Mapped-Model", clean_model_name.as_str()),
            ("X-Account-Email", email_header.as_str()),
        ],
        Json(openai_response),
    )
        .into_response())
}

// ==========================================
// CODE INTEGRATION: Codex WebSocket Handler
// ==========================================




// ==========================================

// CODE INTEGRATION: Global Tool Call Cache

// ==========================================

