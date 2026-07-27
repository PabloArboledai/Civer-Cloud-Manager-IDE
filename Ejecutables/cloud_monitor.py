import urllib.request, json, time, sys

print('Obteniendo credenciales de la bóveda...')
try:
    req = urllib.request.urlopen('http://localhost:5000/vault/credentials/github')
    vault = json.loads(req.read().decode())
    token = None
    for k, v in vault.items():
        if 'token' in k.lower() or 'key' in k.lower(): token = v
    if not token:
        print('Error: Token no encontrado en la bóveda.')
        sys.exit(1)
except Exception as e:
    print('Error contactando bóveda:', e)
    sys.exit(1)

headers = {
    'Accept': 'application/vnd.github+json', 
    'Authorization': f'Bearer {token}', 
    'X-GitHub-Api-Version': '2022-11-28', 
    'User-Agent': 'CiverCloud'
}

print('Buscando ejecución en curso...')
req = urllib.request.Request('https://api.github.com/repos/pablo-arboleadi/Antigravity-Manager/actions/workflows/release.yml/runs?per_page=1', headers=headers)
res = json.loads(urllib.request.urlopen(req).read().decode())
if not res['workflow_runs']:
    print("No se encontraron ejecuciones.")
    sys.exit(1)
    
run = res['workflow_runs'][0]
run_id = run['id']
print(f'✅ Ejecución encontrada: {run["html_url"]}')
print('Monitoreando el progreso de la compilación en los servidores de GitHub...')

while True:
    req = urllib.request.Request(f'https://api.github.com/repos/pablo-arboleadi/Antigravity-Manager/actions/runs/{run_id}', headers=headers)
    status_data = json.loads(urllib.request.urlopen(req).read().decode())
    status = status_data['status']
    conclusion = status_data.get('conclusion')
    
    if status == 'completed':
        if conclusion == 'success':
            print(f'🚀🎉 ¡Compilación en la nube completada con éxito!')
        else:
            print(f'❌ Hubo un fallo en la compilación: {conclusion}')
        break
    else:
        print(f'⏳ Estado actual: {status}... (Fase en progreso)')
    
    time.sleep(10)
