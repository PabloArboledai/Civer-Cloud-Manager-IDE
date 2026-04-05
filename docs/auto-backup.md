# Respaldo Automático

Este repositorio ahora incluye un flujo local de respaldo que puede crear snapshots y hacer push de la rama actual a un repositorio privado de GitHub después de 5 minutos sin cambios.

## Qué Hace

- `scripts/auto-backup.mjs` revisa el árbol de trabajo, espera un periodo de silencio de 5 minutos, crea un snapshot cuando hace falta y hace push de la rama actual al remoto de respaldo configurado.
- `scripts/run-auto-backup.ps1` es el runner compatible con Windows que resuelve `node.exe`, escribe en `logs/auto-backup.log` y ejecuta el script de respaldo desde la raíz del repositorio.
- `scripts/register-auto-backup-task.ps1` crea una tarea programada que ejecuta el runner cada minuto.
- `scripts/setup-auto-backup.mjs` crea o reutiliza un repositorio privado de GitHub, almacena las credenciales con Git Credential Manager y configura el remoto `backup`.

## Comandos

```plaintext
npm run autobackup:setup
npm run autobackup:check
npm run autobackup:register-task
```

## Variables de Entorno Requeridas

La configuración espera un token de GitHub en una de estas variables:

```plaintext
AUTO_BACKUP_GITHUB_TOKEN
GITHUB_TOKEN
```

Variables opcionales:

```plaintext
AUTO_BACKUP_REPO_NAME
AUTO_BACKUP_REMOTE
AUTO_BACKUP_COMMIT_NAME
AUTO_BACKUP_COMMIT_EMAIL
AUTO_BACKUP_NODE_BIN
AUTO_BACKUP_GIT_BIN
AUTO_BACKUP_QUIET_MS
AUTO_BACKUP_BRANCH
```

## Notas

- El archivo de estado del respaldo se guarda en `.git/auto-backup-state.json`.
- Las credenciales se almacenan en Git Credential Manager en lugar de dentro del repositorio.
- La tarea programada corre cada minuto, pero solo se crea un commit de respaldo cuando el árbol de trabajo lleva 5 minutos en silencio.
