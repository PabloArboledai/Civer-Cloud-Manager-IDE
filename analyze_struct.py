with open(r'C:\Users\Administrator\Desktop\Antigravity-Manager\src-tauri\src\proxy\token_manager\mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_struct = False
brace_count = 0
for line in lines:
    if line.startswith('pub struct TokenManager {'):
        in_struct = True
        brace_count = 1
        print(line, end='')
        continue
    
    if in_struct:
        print(line, end='')
        brace_count += line.count('{') - line.count('}')
        if brace_count == 0:
            break
