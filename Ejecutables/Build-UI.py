import tkinter as tk
from tkinter import scrolledtext
from tkinter.ttk import Progressbar, Style
import subprocess
import threading
import sys

IDE_DIR = r"C:\ProyectoCiverCloudUnificado\Desktop-y-Extensiones\Civer-Cloud-Manager-IDE"

def run_build(text_widget, progress_bar, status_label):
    status_label.config(text="Iniciando Compilación Tauri (Frontend + Backend)", fg="#3498db")
    progress_bar['value'] = 5
    
    import os
    env = os.environ.copy()
    try:
        with open(os.path.join(IDE_DIR, "tauri.key"), "r") as f:
            env["TAURI_SIGNING_PRIVATE_KEY"] = f.read().strip()
        with open(os.path.join(IDE_DIR, "pass.txt"), "r") as f:
            env["TAURI_KEY_PASSWORD"] = f.readline().strip()
    except Exception as e:
        print(f"Advertencia: No se pudieron cargar las llaves del updater - {e}")

    # Enable unbuffered output from npm run tauri build
    process = subprocess.Popen(
        "npm run tauri build", 
        shell=True, 
        cwd=IDE_DIR, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1,
        env=env
    )
    
    for line in iter(process.stdout.readline, ''):
        text_widget.insert(tk.END, line)
        text_widget.see(tk.END)
        
        lower_line = line.lower()
        if "vite build" in lower_line or "building frontend" in lower_line:
            progress_bar['value'] = 20
            status_label.config(text="Fase 1/3: Compilando Frontend (Vite/React)...", fg="#f39c12")
        elif "compiling" in lower_line and "rs" in lower_line:
            # Advance progress slowly as packages compile
            if progress_bar['value'] < 80:
                progress_bar['value'] += 0.5
            status_label.config(text="Fase 2/3: Compilando Backend (Rust)...", fg="#e67e22")
        elif "finished" in lower_line and "release" in lower_line:
            progress_bar['value'] = 85
        elif "bundling" in lower_line:
            progress_bar['value'] = 90
            status_label.config(text="Fase 3/3: Empaquetando Ejecutable (MSI / EXE)...", fg="#9b59b6")

    process.stdout.close()
    return_code = process.wait()
    
    if return_code == 0:
        progress_bar['value'] = 100
        status_label.config(text="Construcción Completada Exitosamente!", fg="#2ecc71")
    else:
        status_label.config(text=f"Fallo en la construcción (Código de Salida: {return_code})", fg="#e74c3c")

root = tk.Tk()
root.title("Civer Cloud Manager - Interactive Build System")
root.geometry("900x600")
root.configure(bg="#2c3e50")

# Stylize progress bar
style = Style()
style.theme_use('default')
style.configure("TProgressbar", thickness=25, background='#2ecc71', troughcolor='#34495e')

tk.Label(root, text="Proceso de Compilación Interactivo (Tauri)", font=("Segoe UI", 18, "bold"), bg="#2c3e50", fg="white").pack(pady=15)

status_lbl = tk.Label(root, text="Preparando...", font=("Segoe UI", 14, "bold"), bg="#2c3e50", fg="white")
status_lbl.pack(pady=5)

pb = Progressbar(root, orient=tk.HORIZONTAL, length=800, mode='determinate', style="TProgressbar")
pb.pack(pady=15)

txt = scrolledtext.ScrolledText(root, width=110, height=22, bg="#1e272e", fg="#00d2d3", font=("Consolas", 10))
txt.pack(pady=10)

threading.Thread(target=run_build, args=(txt, pb, status_lbl), daemon=True).start()

root.mainloop()
