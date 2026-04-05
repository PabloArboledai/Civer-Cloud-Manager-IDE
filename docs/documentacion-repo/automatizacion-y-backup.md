# Automatizacion y backup

Resumen:
- el repo incluye un sistema de auto backup local
- puede crear un repo privado de GitHub para espejo
- puede registrar una tarea programada de Windows
- hace commit y push automatico tras 5 minutos de inactividad del arbol de trabajo

Scripts:
- `scripts/auto-backup.mjs`
- `scripts/setup-auto-backup.mjs`
- `scripts/register-auto-backup-task.ps1`
- `scripts/run-auto-backup.ps1`

Comandos expuestos:
- `npm run autobackup:setup`
- `npm run autobackup:check`
- `npm run autobackup:register-task`

Como funciona `auto-backup.mjs`:
- valida que este en la raiz de un repo Git
- asegura identidad de commit
- verifica que exista el remoto de backup
- si el arbol esta limpio:
  hace push de `HEAD` si ese commit aun no fue respaldado
- si el arbol esta sucio:
  mide tiempo de silencio por firma de cambios y `mtime`
  espera `5 minutos` por defecto
  al cumplirse, hace `git add -A`, crea commit `chore(auto-backup): respaldo ...` y push al remoto configurado

Estado interno:
- archivo:
  `.git/auto-backup-state.json`
- guarda:
  `lastSuccessfulHead`
  `lastDirtySignature`
  `lastDirtyChangeAt`

Setup GitHub:
- `setup-auto-backup.mjs` usa `AUTO_BACKUP_GITHUB_TOKEN` o `GITHUB_TOKEN`
- obtiene usuario con `/user`
- crea o reutiliza un repo privado
- configura remoto `backup`
- guarda credenciales en Git Credential Manager

Task Scheduler:
- `register-auto-backup-task.ps1` crea tarea Windows que corre cada minuto
- el runner PowerShell resuelve `node.exe`, escribe en `logs/auto-backup.log` y ejecuta el script JS

Variables de entorno relevantes:
- `AUTO_BACKUP_GITHUB_TOKEN`
- `GITHUB_TOKEN`
- `AUTO_BACKUP_REPO_NAME`
- `AUTO_BACKUP_REMOTE`
- `AUTO_BACKUP_COMMIT_NAME`
- `AUTO_BACKUP_COMMIT_EMAIL`
- `AUTO_BACKUP_NODE_BIN`
- `AUTO_BACKUP_GIT_BIN`
- `AUTO_BACKUP_QUIET_MS`
- `AUTO_BACKUP_BRANCH`

Riesgos y matices:
- el sistema hace `git add -A` y commit de todo el arbol de trabajo al cumplirse el silencio.
- eso incluye cambios no revisados o trabajo en curso.
- no distingue entre cambios del usuario y cambios de agentes.
- es util como red de seguridad, no como sustituto del control humano sobre el historial.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\auto-backup.mjs`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\setup-auto-backup.mjs`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\register-auto-backup-task.ps1`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\run-auto-backup.ps1`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\docs\auto-backup.md`
