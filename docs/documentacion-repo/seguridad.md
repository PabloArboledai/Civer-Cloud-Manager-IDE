# Seguridad

Resumen: la app cifra tokens y cuotas en SQLite usando AES-256-GCM. La master key vive en `safeStorage` o `keytar` con fallback local. Se enmascaran secretos en logs y se evita exponer tokens en la UI.

Cifrado:
- AES-256-GCM para `token_json` y `quota_json`.
- Master key almacenada en `safeStorage` o `keytar`.
- Fallback en archivo local con re-encriptacion al migrar.

Proteccion de logs:
- Masking de tokens, api keys y secretos.
- Log dedicado para ORPC con mascaras.

Auth del proxy:
- API key en headers.
- Modo abierto si no hay api key configurada.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\security.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\sensitiveDataMasking.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\guards\proxy.guard.ts`
