"""
Credential Vault Sync
=====================
Sincroniza credenciales entre nodos de la malla via HTTP API.
También carga credenciales al MCP Memory server para acceso desde agentes de IA.

Uso:
    python vault-sync.py                    # Sync con todos los nodos
    python vault-sync.py --push             # Push local → todos los nodos
    python vault-sync.py --pull             # Pull desde nodo primario → local
    python vault-sync.py --mcp-memory       # Cargar credenciales a MCP Memory
    python vault-sync.py --watch            # Watch mode: sync continuo
"""

import os
import sys
import json
import time
import hashlib
import urllib.request
import urllib.error
from datetime import datetime

# === Configuración ===
VAULT_PORT = 9876
LOCAL_VAULT_URL = f"http://127.0.0.1:{VAULT_PORT}"

# Nodo primario (donde está el vault autoritativo)
PRIMARY_NODE = "100.79.100.72"  # Lenovo Windows (control node)

# Todos los nodos de la malla
MESH_NODES = {
    "vultr-guest": "100.82.34.57",
    "lenovo-wsl": "100.126.182.68",
    "lenovo-windows": "100.79.100.72",
    "hp-one": "100.104.166.73",
    "laptop": "100.96.218.12",
}

# Rutas de búsqueda de credenciales locales
CREDENTIAL_SEARCH_PATHS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "secrets", "CREDENTIALS_DB.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bundle", "shared-vault", "secrets", "CREDENTIALS_DB.json"),
    os.path.join(os.path.expanduser("~"), "Desktop", "Coexion", "engram-shared", "secrets", "CREDENTIALS_DB.json"),
    os.path.join(os.path.expanduser("~"), "Desktop", "engram-mesh-infrastructure", "secrets", "CREDENTIALS_DB.json"),
    "C:\\Users\\Administrator\\Desktop\\Coexion\\engram-shared\\secrets\\CREDENTIALS_DB.json",
    "C:\\Users\\Usuario\\Desktop\\Coexion\\engram-shared\\secrets\\CREDENTIALS_DB.json",
    "/root/mesh-shared-vault/secrets/CREDENTIALS_DB.json",
    "/home/miguel/mesh-shared-vault/secrets/CREDENTIALS_DB.json",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "CREDENTIALS_DB.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault-data.json"),
]

# MCP Memory server config
MCP_MEMORY_URL = "http://127.0.0.1:3000"  # Default MCP memory server


def find_local_credentials():
    """Buscar archivo de credenciales local."""
    for path in CREDENTIAL_SEARCH_PATHS:
        if os.path.exists(path):
            return path
    return None


def load_local_credentials():
    """Cargar credenciales desde archivo local."""
    path = find_local_credentials()
    if not path:
        print("[SYNC] No local credentials file found")
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[SYNC] Error loading credentials: {e}")
        return None


def fetch_vault(node_ip, endpoint="/vault/credentials"):
    """Obtener credenciales desde un nodo remoto."""
    url = f"http://{node_ip}:{VAULT_PORT}{endpoint}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.URLError as e:
        print(f"[SYNC] Cannot reach {node_ip}: {e.reason}")
        return None
    except Exception as e:
        print(f"[SYNC] Error fetching from {node_ip}: {e}")
        return None


def push_to_node(node_ip, credentials):
    """Push credenciales a un nodo remoto."""
    url = f"http://{node_ip}:{VAULT_PORT}/vault/credentials"
    try:
        data = json.dumps(credentials).encode('utf-8')
        req = urllib.request.Request(url, data=data, method='PUT',
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"[SYNC] Error pushing to {node_ip}: {e}")
        return None


def compute_hash(data):
    """Calcular hash de credenciales para comparación."""
    return hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()


def sync_push():
    """Push credenciales locales a todos los nodos."""
    creds = load_local_credentials()
    if not creds:
        print("[SYNC] No local credentials to push")
        return
    
    local_hash = compute_hash(creds)
    print(f"[SYNC] Local credentials hash: {local_hash}")
    
    for name, ip in MESH_NODES.items():
        print(f"[SYNC] Pushing to {name} ({ip})...", end=" ")
        remote = fetch_vault(ip, "/vault/health")
        if remote:
            # Check if vault server is running
            result = push_to_node(ip, creds)
            if result:
                print("OK")
            else:
                print("FAILED (push error)")
        else:
            print("SKIPPED (vault not running)")


def sync_pull():
    """Pull credenciales desde nodo primario."""
    print(f"[SYNC] Pulling from primary node {PRIMARY_NODE}...")
    remote_creds = fetch_vault(PRIMARY_NODE)
    
    if not remote_creds:
        print("[SYNC] Cannot reach primary node, trying other nodes...")
        for name, ip in MESH_NODES.items():
            if ip == PRIMARY_NODE:
                continue
            remote_creds = fetch_vault(ip)
            if remote_creds:
                print(f"[SYNC] Got credentials from {name}")
                break
    
    if not remote_creds:
        print("[SYNC] No remote credentials available")
        return
    
    # Guardar localmente
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault-data.json")
    with open(local_path, 'w', encoding='utf-8') as f:
        json.dump(remote_creds, f, indent=4)
    print(f"[SYNC] Saved to {local_path}")


def sync_check():
    """Verificar consistencia de credenciales entre nodos."""
    local_creds = load_local_credentials()
    if not local_creds:
        print("[SYNC] No local credentials")
        return
    
    local_hash = compute_hash(local_creds)
    print(f"[SYNC] Local hash: {local_hash}")
    print()
    
    for name, ip in MESH_NODES.items():
        remote = fetch_vault(ip, "/vault/credentials")
        if remote:
            remote_hash = compute_hash(remote)
            match = "✅ MATCH" if remote_hash == local_hash else "❌ DIFFERENT"
            print(f"  {name} ({ip}): {remote_hash} {match}")
        else:
            print(f"  {name} ({ip}): ⚠️ UNREACHABLE")


def sync_mcp_memory():
    """Cargar credenciales al MCP Memory server para acceso desde agentes de IA.
    
    Esto permite que cualquier agente Roo Code con acceso al MCP Memory server
    pueda consultar credenciales usando search_nodes o open_nodes.
    """
    creds = load_local_credentials()
    if not creds:
        print("[MCP] No credentials to load")
        return
    
    print("[MCP] Loading credentials to MCP Memory server...")
    
    # Crear entidades en el knowledge graph para cada categoría
    entities = []
    relations = []
    
    # Entidad raíz del vault
    entities.append({
        "name": "CredentialVault",
        "entityType": "credential_vault",
        "observations": [
            f"Last updated: {datetime.now().isoformat()}",
            f"Categories: {', '.join(creds.keys())}",
            f"Total hosts: {len(creds.get('hosts', {}))}",
        ]
    })
    
    # Entidades por host
    for host_name, host_data in creds.get("hosts", {}).items():
        observations = [f"Host: {host_name}"]
        if isinstance(host_data, dict):
            for key, value in host_data.items():
                if key not in ["password_candidates"]:  # No poner passwords en observations
                    observations.append(f"{key}: {value}")
                else:
                    observations.append(f"{key}: {len(value)} candidates")
        
        entities.append({
            "name": f"Host_{host_name}",
            "entityType": "credential_host",
            "observations": observations
        })
        relations.append({
            "from": "CredentialVault",
            "to": f"Host_{host_name}",
            "relationType": "contains"
        })
    
    # Entidades por categoría de secret
    for category_name, category_data in creds.items():
        if category_name == "hosts":
            continue  # Ya procesado arriba
        
        observations = [f"Category: {category_name}"]
        if isinstance(category_data, dict):
            for key, value in category_data.items():
                if isinstance(value, (str, int, bool, float)):
                    observations.append(f"{key}: {value}")
                elif isinstance(value, list):
                    observations.append(f"{key}: {len(value)} items")
                elif isinstance(value, dict):
                    observations.append(f"{key}: {list(value.keys())}")
        
        entities.append({
            "name": f"Secret_{category_name}",
            "entityType": "credential_category",
            "observations": observations
        })
        relations.append({
            "from": "CredentialVault",
            "to": f"Secret_{category_name}",
            "relationType": "contains"
        })
    
    # Guardar como archivo JSON para importar via MCP
    mcp_export_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp-memory-import.json")
    with open(mcp_export_path, 'w', encoding='utf-8') as f:
        json.dump({"entities": entities, "relations": relations}, f, indent=4)
    
    print(f"[MCP] Exported {len(entities)} entities and {len(relations)} relations")
    print(f"[MCP] Saved to: {mcp_export_path}")
    print(f"[MCP] Import this file using MCP Memory create_entities and create_relations tools")


def sync_watch(interval=60):
    """Watch mode: verificar cambios y sync continuo."""
    print(f"[SYNC] Watch mode started (interval: {interval}s)")
    print("[SYNC] Press Ctrl+C to stop")
    
    last_hash = ""
    while True:
        try:
            creds = load_local_credentials()
            if creds:
                current_hash = compute_hash(creds)
                if current_hash != last_hash:
                    print(f"[{datetime.now().isoformat()}] Credentials changed! Hash: {current_hash}")
                    last_hash = current_hash
                    # Auto-push a todos los nodos
                    sync_push()
                else:
                    print(f"[{datetime.now().isoformat()}] No changes (hash: {current_hash[:8]}...)")
            
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[SYNC] Watch stopped.")
            break


def main():
    if len(sys.argv) < 2:
        print("Usage: python vault-sync.py [--push|--pull|--check|--mcp-memory|--watch]")
        print()
        print("Commands:")
        print("  --push        Push local credentials to all mesh nodes")
        print("  --pull        Pull credentials from primary node")
        print("  --check       Check consistency across all nodes")
        print("  --mcp-memory  Load credentials to MCP Memory server")
        print("  --watch       Watch mode: auto-sync on changes")
        return
    
    cmd = sys.argv[1]
    
    if cmd == "--push":
        sync_push()
    elif cmd == "--pull":
        sync_pull()
    elif cmd == "--check":
        sync_check()
    elif cmd == "--mcp-memory":
        sync_mcp_memory()
    elif cmd == "--watch":
        interval = 60
        for arg in sys.argv[2:]:
            if arg.startswith("--interval="):
                interval = int(arg.split("=")[1])
        sync_watch(interval)
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
