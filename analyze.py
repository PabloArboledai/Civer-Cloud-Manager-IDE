import re

with open(r'C:\Users\Administrator\Desktop\Antigravity-Manager\src-tauri\src\proxy\token_manager\mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_impl = False
brace_count = 0
for i, line in enumerate(lines):
    if line.startswith('impl TokenManager {'):
        in_impl = True
        brace_count = 1
        continue
    
    if in_impl:
        brace_count += line.count('{') - line.count('}')
        if brace_count == 0:
            in_impl = False
        
        match = re.match(r'^\s+(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(', line)
        if match:
            print(match.group(1))
