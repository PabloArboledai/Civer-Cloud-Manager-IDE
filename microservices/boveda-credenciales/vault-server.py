"""
Credential Vault Server
=======================
Servidor HTTP API para almacenamiento y consulta de credenciales
accesible desde cualquier nodo de la malla via Tailscale.

Características:
- Almacenamiento centralizado con replicación
- HTTP API REST para consulta desde cualquier nodo
- Sin autenticación ni limitaciones de acceso
- Audit log de consultas
- Hot-reload: recarga credenciales desde archivo si cambia
- Endpoints para sync entre nodos

Uso:
    python vault-server.py [--port 9876] [--host 0.0.0.0]
"""

import os
import sys
import json
import time
import hashlib
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# === Configuración ===
DEFAULT_PORT = 9876
DEFAULT_HOST = "0.0.0.0"

# Rutas donde buscar el archivo de credenciales
CREDENTIAL_SEARCH_PATHS = [
    # Engram-shared (workspace actual)
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "secrets", "CREDENTIALS_DB.json"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bundle", "shared-vault", "secrets", "CREDENTIALS_DB.json"),
    # Desktop paths
    os.path.join(os.path.expanduser("~"), "Desktop", "Coexion", "engram-shared", "secrets", "CREDENTIALS_DB.json"),
    os.path.join(os.path.expanduser("~"), "Desktop", "engram-mesh-infrastructure", "secrets", "CREDENTIALS_DB.json"),
    # Mesh shared vault
    "C:\\Users\\Administrator\\Desktop\\Coexion\\engram-shared\\secrets\\CREDENTIALS_DB.json",
    "C:\\Users\\Usuario\\Desktop\\Coexion\\engram-shared\\secrets\\CREDENTIALS_DB.json",
    "/root/mesh-shared-vault/secrets/CREDENTIALS_DB.json",
    "/home/miguel/mesh-shared-vault/secrets/CREDENTIALS_DB.json",
    # Direct path
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "CREDENTIALS_DB.json"),
]

# Archivo de vault local (para updates)
VAULT_LOCAL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault-data.json")

# Audit log
AUDIT_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault-audit.log")

# Nodos de la malla para sync
MESH_NODES = {
    "vultr-guest": "100.82.34.57",
    "lenovo-wsl": "100.126.182.68",
    "lenovo-windows": "100.79.100.72",
    "hp-one": "100.104.166.73",
    "laptop": "100.96.218.12",
}

class CredentialVault:
    """Almacén de credenciales con hot-reload y audit."""
    
    def __init__(self):
        self.data = {}
        self.last_hash = ""
        self.last_load = 0
        self.source_path = None
        self.lock = threading.Lock()
        self._load_credentials()
    
    def _find_credentials_file(self):
        """Buscar archivo de credenciales en rutas conocidas."""
        for path in CREDENTIAL_SEARCH_PATHS:
            if os.path.exists(path):
                return path
        return None
    
    def _load_credentials(self):
        """Cargar credenciales desde archivo."""
        # Primero intentar vault local
        if os.path.exists(VAULT_LOCAL_PATH):
            path = VAULT_LOCAL_PATH
        else:
            path = self._find_credentials_file()
        
        if not path:
            print(f"[VAULT] WARNING: No credentials file found!")
            print(f"[VAULT] Searched in:")
            for p in CREDENTIAL_SEARCH_PATHS:
                print(f"  - {p}")
            self.data = {"_meta": {"error": "No credentials file found", "searched": CREDENTIAL_SEARCH_PATHS}}
            return
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_hash = hashlib.md5(content.encode()).hexdigest()
            if new_hash == self.last_hash:
                return  # No cambió
            
            self.data = json.loads(content)
            self.last_hash = new_hash
            self.source_path = path
            self.last_load = time.time()
            print(f"[VAULT] Loaded credentials from: {path}")
            print(f"[VAULT] Categories: {list(self.data.keys())}")
        except Exception as e:
            print(f"[VAULT] ERROR loading credentials: {e}")
    
    def reload_if_changed(self):
        """Recargar si el archivo cambió (hot-reload)."""
        with self.lock:
            self._load_credentials()
    
    def get_all(self):
        """Obtener todas las credenciales."""
        self.reload_if_changed()
        return self.data
    
    def get_category(self, category):
        """Obtener credenciales de una categoría específica."""
        self.reload_if_changed()
        return self.data.get(category, {})
    
    def get_host(self, host_name):
        """Obtener credenciales de un host específico."""
        self.reload_if_changed()
        hosts = self.data.get("hosts", {})
        return hosts.get(host_name, {})
    
    def search(self, query):
        """Buscar credenciales por query (búsqueda recursiva en keys y values)."""
        self.reload_if_changed()
        results = []
        query_lower = query.lower()
        self._search_recursive(self.data, query_lower, [], results)
        return results
    
    def _search_recursive(self, obj, query, path, results):
        """Búsqueda recursiva en estructura de credenciales."""
        if isinstance(obj, dict):
            for key, value in obj.items():
                new_path = path + [key]
                if query in key.lower():
                    results.append({"path": ".".join(new_path), "value": value})
                self._search_recursive(value, query, new_path, results)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                self._search_recursive(item, query, path + [str(i)], results)
        elif isinstance(obj, str) and query in obj.lower():
            results.append({"path": ".".join(path), "value": obj})
    
    def update_credential(self, path_parts, value):
        """Actualizar una credencial específica."""
        with self.lock:
            obj = self.data
            for part in path_parts[:-1]:
                if part not in obj:
                    obj[part] = {}
                obj = obj[part]
            obj[path_parts[-1]] = value
            
            # Guardar en vault local
            with open(VAULT_LOCAL_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=4)
            
            self.last_hash = ""  # Forzar reload en siguiente consulta
        return True
    
    def log_access(self, client_ip, endpoint, query=""):
        """Registrar acceso en audit log."""
        try:
            with open(AUDIT_LOG_PATH, 'a', encoding='utf-8') as f:
                timestamp = datetime.now().isoformat()
                f.write(f"{timestamp} | {client_ip} | {endpoint} | {query}\n")
        except:
            pass  # Audit log no es crítico


# Instancia global del vault
vault = CredentialVault()


class VaultHTTPHandler(BaseHTTPRequestHandler):
    """Handler HTTP para la API del Credential Vault."""
    
    def log_message(self, format, *args):
        """Silenciar logs HTTP por defecto."""
        pass
    
    def _send_json(self, data, status=200):
        """Enviar respuesta JSON."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8'))
    
    def _get_client_ip(self):
        """Obtener IP del cliente."""
        return self.client_address[0]
    
    def do_GET(self):
        """Manejar peticiones GET."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        params = parse_qs(parsed.query)
        client_ip = self._get_client_ip()
        
        # === Endpoints ===
        
        # Health check
        if path == '/vault/health':
            vault.log_access(client_ip, 'health')
            self._send_json({
                "status": "ok",
                "vault_loaded": bool(vault.data),
                "source": vault.source_path,
                "last_load": vault.last_load,
                "categories": list(vault.data.keys()) if vault.data else [],
                "mesh_nodes": MESH_NODES
            })
            return
        
        # Todas las credenciales
        if path == '/vault/credentials':
            vault.log_access(client_ip, 'credentials')
            self._send_json(vault.get_all())
            return
        
        # Categoría específica
        if path.startswith('/vault/credentials/'):
            category = path.split('/vault/credentials/')[1]
            vault.log_access(client_ip, f'credentials/{category}')
            data = vault.get_category(category)
            if data:
                self._send_json(data)
            else:
                self._send_json({"error": f"Category '{category}' not found", "available": list(vault.data.keys())}, 404)
            return
        
        # Host específico
        if path.startswith('/vault/host/'):
            host_name = path.split('/vault/host/')[1]
            vault.log_access(client_ip, f'host/{host_name}')
            data = vault.get_host(host_name)
            if data:
                self._send_json(data)
            else:
                hosts = vault.data.get("hosts", {})
                self._send_json({"error": f"Host '{host_name}' not found", "available": list(hosts.keys())}, 404)
            return
        
        # Búsqueda
        if path == '/vault/search':
            query = params.get('q', [''])[0]
            if not query:
                self._send_json({"error": "Missing 'q' parameter", "usage": "/vault/search?q=keyword"})
                return
            vault.log_access(client_ip, 'search', query)
            results = vault.search(query)
            self._send_json({"query": query, "results": results, "count": len(results)})
            return
        
        # Nodos de la malla
        if path == '/vault/mesh-nodes':
            vault.log_access(client_ip, 'mesh-nodes')
            self._send_json(MESH_NODES)
            return
        
        # Audit log
        if path == '/vault/audit':
            vault.log_access(client_ip, 'audit')
            try:
                with open(AUDIT_LOG_PATH, 'r', encoding='utf-8') as f:
                    lines = f.readlines()[-100:]  # Últimas 100 entradas
                self._send_json({"entries": [l.strip() for l in lines]})
            except:
                self._send_json({"entries": []})
            return
        
        # File download (for auto-deploy)
        if path.startswith('/vault/file/'):
            filename = path.split('/vault/file/')[1]
            # Only allow specific files for security
            allowed_files = {
                'vault-server.py': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vault-server.py'),
                'vault-sync.py': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vault-sync.py'),
                'CREDENTIALS_DB.json': vault.source_path,
                'deploy-vault-mesh.sh': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'deploy-vault-mesh.sh'),
                'DEPLOY-CREDENTIAL-VAULT.ps1': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'DEPLOY-CREDENTIAL-VAULT.ps1'),
            }
            if filename not in allowed_files:
                self._send_json({"error": f"File '{filename}' not available", "available": list(allowed_files.keys())}, 404)
                return
            file_path = allowed_files[filename]
            if not os.path.exists(file_path):
                self._send_json({"error": f"File not found on disk: {filename}"}, 404)
                return
            try:
                vault.log_access(client_ip, f'file/{filename}')
                with open(file_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                # Set content type based on extension
                if filename.endswith('.py'):
                    self.send_header('Content-Type', 'text/x-python; charset=utf-8')
                elif filename.endswith('.json'):
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                elif filename.endswith('.sh'):
                    self.send_header('Content-Type', 'text/x-shellscript; charset=utf-8')
                elif filename.endswith('.ps1'):
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self._send_json({"error": f"Error reading file: {str(e)}"}, 500)
            return
        
        # Root - info
        if path == '' or path == '/vault' or path == '/':
            vault.log_access(client_ip, 'root')
            self._send_json({
                "name": "Credential Vault",
                "version": "1.0.0",
                "endpoints": {
                    "GET /vault/health": "Health check",
                    "GET /vault/credentials": "Todas las credenciales",
                    "GET /vault/credentials/{category}": "Categoría específica",
                    "GET /vault/host/{host_name}": "Host específico",
                    "GET /vault/search?q=keyword": "Buscar credenciales",
                    "GET /vault/mesh-nodes": "Nodos de la malla",
                    "GET /vault/audit": "Audit log",
                    "GET /vault/file/{filename}": "Descargar archivo del vault (auto-deploy)",
                    "PUT /vault/credentials/{path}": "Actualizar credencial",
                    "POST /vault/sync": "Forzar sync con otros nodos",
                }
            })
            return
        
        self._send_json({"error": "Not found"}, 404)
    
    def do_PUT(self):
        """Manejar peticiones PUT para actualizar credenciales."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        client_ip = self._get_client_ip()
        
        # Actualizar credencial
        if path.startswith('/vault/credentials/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                new_value = json.loads(body)
            except:
                self._send_json({"error": "Invalid JSON body"}, 400)
                return
            
            path_parts = path.split('/vault/credentials/')[1].split('/')
            vault.log_access(client_ip, f'update/{"/".join(path_parts)}')
            
            if vault.update_credential(path_parts, new_value):
                self._send_json({"status": "updated", "path": ".".join(path_parts)})
            else:
                self._send_json({"error": "Failed to update"}, 500)
            return
        
        self._send_json({"error": "Not found"}, 404)
    
    def do_POST(self):
        """Manejar peticiones POST."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        client_ip = self._get_client_ip()
        
        # Forzar reload
        if path == '/vault/reload':
            vault.log_access(client_ip, 'reload')
            vault.last_hash = ""  # Forzar reload
            vault.reload_if_changed()
            self._send_json({"status": "reloaded", "source": vault.source_path})
            return
        
        # Sync con otros nodos
        if path == '/vault/sync':
            vault.log_access(client_ip, 'sync')
            # TODO: Implementar sync con otros nodos
            self._send_json({"status": "sync initiated", "nodes": MESH_NODES})
            return
        
        self._send_json({"error": "Not found"}, 404)
    
    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def run_server(host=DEFAULT_HOST, port=DEFAULT_PORT):
    """Iniciar servidor del Credential Vault."""
    server = HTTPServer((host, port), VaultHTTPHandler)
    print("=" * 50)
    print("  [CREDENTIAL VAULT SERVER]")
    print("=" * 50)
    print(f"  Listening: http://{host}:{port}")
    print(f"  Vault API: http://{host}:{port}/vault/credentials")
    print(f"  Health:    http://{host}:{port}/vault/health")
    print(f"  Source:    {vault.source_path or 'NOT FOUND'}")
    print("=" * 50)
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[VAULT] Server stopped.")
        server.server_close()


if __name__ == "__main__":
    try:
        # Forzar flush en cada print para que el orquestador capture los logs inmediatamente
        import builtins
        _original_print = builtins.print
        def _flushed_print(*args, **kwargs):
            kwargs['flush'] = True
            _original_print(*args, **kwargs)
        builtins.print = _flushed_print

        port = DEFAULT_PORT
        host = DEFAULT_HOST
        
        for arg in sys.argv[1:]:
            if arg.startswith("--port="):
                port = int(arg.split("=")[1])
            elif arg == "--port" and sys.argv.index(arg) + 1 < len(sys.argv):
                # Soporte para --port 5000 (separado por espacio)
                port = int(sys.argv[sys.argv.index(arg) + 1])
            elif arg.startswith("--host="):
                host = arg.split("=")[1]
            elif arg == "--host" and sys.argv.index(arg) + 1 < len(sys.argv):
                host = sys.argv[sys.argv.index(arg) + 1]
        
        run_server(host, port)
    except Exception as e:
        import traceback
        print(f"[FATAL ERROR] El servidor de boveda-credenciales falló al iniciar: {e}", flush=True)
        traceback.print_exc()
        sys.exit(1)
