# Auto Backup

This repository now includes a local backup flow that can snapshot and push the current branch to a private GitHub repository after 5 minutes without changes.

## What It Does

- `scripts/auto-backup.mjs` checks the working tree, waits for a 5-minute quiet period, commits a snapshot when needed, and pushes the current branch to the configured backup remote.
- `scripts/run-auto-backup.ps1` is the Windows-friendly runner that resolves `node.exe`, writes to `logs/auto-backup.log`, and executes the backup script from the repository root.
- `scripts/register-auto-backup-task.ps1` creates a Scheduled Task that runs the runner every minute.
- `scripts/setup-auto-backup.mjs` creates or reuses a private GitHub repository, stores credentials through Git Credential Manager, and configures the `backup` remote.

## Commands

```plaintext
npm run autobackup:setup
npm run autobackup:check
npm run autobackup:register-task
```

## Required Environment Variables

Setup expects a GitHub token in one of these variables:

```plaintext
AUTO_BACKUP_GITHUB_TOKEN
GITHUB_TOKEN
```

Optional overrides:

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

## Notes

- The backup state file is stored under `.git/auto-backup-state.json`.
- Credentials are stored in Git Credential Manager instead of inside the repository.
- The scheduled task runs every minute, but a backup commit only happens after the working tree has been quiet for 5 minutes.
