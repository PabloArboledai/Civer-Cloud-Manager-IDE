import tkinter as tk
from tkinter import scrolledtext, simpledialog, messagebox
from tkinter.ttk import Progressbar, Style
import threading
import sys
import time
import urllib.request
import json

REPO_OWNER = "PabloArboledai"
REPO_NAME = "draculabo-antigravity-manager-private-backup"
WORKFLOW_ID = "release.yml"

def request_json(url, method="GET", headers=None, data=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            if content:
                return json.loads(content)
            return {"code": response.getcode()}
    except urllib.error.HTTPError as e:
        return {"error": str(e), "code": e.code, "msg": e.read().decode('utf-8') if e.read() else ""}
    except Exception as e:
        return {"error": str(e)}

def get_github_token_from_vault():
    # Intento 1: Obtener de la bóveda local si está disponible
    res = request_json("http://localhost:5000/vault/credentials/github")
    if "error" not in res:
        for key, val in res.items():
            if "token" in key.lower() or "key" in key.lower() or "secret" in key.lower():
                return val
                
    # Intento 2 (Incrustado por defecto): Token seguro
    return "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"

def trigger_cloud_build(text_widget, progress_bar, status_label, root, btn):
    btn.config(state=tk.DISABLED)
    status_label.config(text="Obteniendo Credenciales...", fg="#3498db")
    progress_bar['value'] = 5
    
    token = get_github_token_from_vault()
    if not token:
        # Prompt user if not found in vault
        token = simpledialog.askstring("GitHub Token", "No se encontró el token de GitHub en la Bóveda.\nIngresa tu Personal Access Token (PAT) de GitHub (classic o fine-grained):", parent=root)
        if not token:
            status_label.config(text="Cancelado: Se requiere Token de GitHub.", fg="#e74c3c")
            btn.config(state=tk.NORMAL)
            return
            
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CiverCloud-Manager"
    }
    
    status_label.config(text="Disparando compilación en GitHub Actions...", fg="#f39c12")
    progress_bar['value'] = 15
    
    url_dispatch = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/workflows/{WORKFLOW_ID}/dispatches"
    dispatch_res = request_json(url_dispatch, method="POST", headers=headers, data={"ref": "main"})
    
    if dispatch_res and "error" in dispatch_res:
        if dispatch_res.get("code") != 204:
            text_widget.insert(tk.END, f"[ERROR] Fallo al disparar workflow: {dispatch_res}\n")
            status_label.config(text="Fallo al contactar GitHub Actions", fg="#e74c3c")
            btn.config(state=tk.NORMAL)
            return
            
    text_widget.insert(tk.END, "[CLOUD] ✅ Workflow 'release.yml' disparado con éxito en la rama 'main'!\n")
    text_widget.insert(tk.END, "[CLOUD] Esperando a que inicie la ejecución (puede tardar unos segundos)...\n")
    
    time.sleep(5)
    url_runs = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/workflows/{WORKFLOW_ID}/runs?per_page=1"
    
    run_id = None
    for _ in range(5):
        runs_data = request_json(url_runs, headers=headers)
        if "workflow_runs" in runs_data and len(runs_data["workflow_runs"]) > 0:
            latest_run = runs_data["workflow_runs"][0]
            run_id = latest_run["id"]
            run_url = latest_run["html_url"]
            text_widget.insert(tk.END, f"[CLOUD] 🚀 Compilación iniciada en los servidores de GitHub!\n")
            text_widget.insert(tk.END, f"[CLOUD] URL del Pipeline: {run_url}\n")
            break
        time.sleep(4)
        
    if not run_id:
        text_widget.insert(tk.END, "[ERROR] No se pudo encontrar el ID de la ejecución.\n")
        status_label.config(text="Error de sincronización", fg="#e74c3c")
        btn.config(state=tk.NORMAL)
        return

    status_label.config(text="Fase 1/3: Preparando clústeres en la nube (Mac, Linux, Windows)...", fg="#e67e22")
    progress_bar['value'] = 25
    
    url_run_status = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs/{run_id}"
    
    while True:
        status_data = request_json(url_run_status, headers=headers)
        if "error" in status_data:
            text_widget.insert(tk.END, f"[ERROR] Error consultando estado: {status_data}\n")
            btn.config(state=tk.NORMAL)
            break
            
        status = status_data.get("status")
        conclusion = status_data.get("conclusion")
        
        if status == "in_progress":
            if progress_bar['value'] < 85:
                progress_bar['value'] += 2
            
            if progress_bar['value'] > 50 and progress_bar['value'] < 80:
                status_label.config(text="Fase 2/3: Compilando en paralelo a máxima velocidad...", fg="#9b59b6")
                
            text_widget.insert(tk.END, f"[CLOUD] ⚡ Estado: En progreso (Jobs activos)...\n")
        elif status == "completed":
            progress_bar['value'] = 100
            if conclusion == "success":
                status_label.config(text="Construcción en Nube Completada Exitosamente! ☁️🚀", fg="#2ecc71")
                text_widget.insert(tk.END, f"\n[CLOUD] 🎉 ¡ÉXITO! Los instaladores han sido compilados y publicados.\n")
                text_widget.insert(tk.END, f"[CLOUD] Descarga tus instaladores aquí: https://github.com/{REPO_OWNER}/{REPO_NAME}/releases/latest\n")
            else:
                status_label.config(text=f"Fallo en la nube (Conclusión: {conclusion})", fg="#e74c3c")
                text_widget.insert(tk.END, f"\n[CLOUD] ❌ Hubo un fallo en la compilación: {conclusion}\n")
                text_widget.insert(tk.END, f"[CLOUD] Revisa los logs en: {status_data.get('html_url')}\n")
            btn.config(state=tk.NORMAL)
            break
        else:
            text_widget.insert(tk.END, f"[CLOUD] ⏳ Estado: {status}...\n")
            
        text_widget.see(tk.END)
        time.sleep(15)

def start_thread():
    threading.Thread(target=trigger_cloud_build, args=(txt, pb, status_lbl, root, btn_start), daemon=True).start()

root = tk.Tk()
root.title("Civer Cloud Manager - CLOUD COMPILER (GitHub Actions)")
root.geometry("900x600")
root.configure(bg="#2c3e50")

style = Style()
style.theme_use('default')
style.configure("TProgressbar", thickness=25, background='#3498db', troughcolor='#34495e')

tk.Label(root, text="Proceso de Compilación en la Nube ☁️⚡", font=("Segoe UI", 18, "bold"), bg="#2c3e50", fg="white").pack(pady=15)

status_lbl = tk.Label(root, text="Haz clic en Iniciar para conectar con la nube...", font=("Segoe UI", 14, "bold"), bg="#2c3e50", fg="white")
status_lbl.pack(pady=5)

pb = Progressbar(root, orient=tk.HORIZONTAL, length=800, mode='determinate', style="TProgressbar")
pb.pack(pady=15)

btn_start = tk.Button(root, text="🚀 INICIAR COMPILACIÓN EN LA NUBE", font=("Segoe UI", 12, "bold"), bg="#2980b9", fg="white", cursor="hand2", command=start_thread)
btn_start.pack(pady=10)

txt = scrolledtext.ScrolledText(root, width=110, height=18, bg="#1e272e", fg="#00d2d3", font=("Consolas", 10))
txt.pack(pady=10)

root.mainloop()
