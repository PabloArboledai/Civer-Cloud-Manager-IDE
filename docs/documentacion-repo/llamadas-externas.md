# Llamadas externas

Resumen: la app habla con servicios de Google para OAuth y Gemini, con endpoints internos de Cloud Code para quotas/modelos, y con servicios de actualizacion y telemetry opcionales.

OAuth y cuenta:
- `https://accounts.google.com/o/oauth2/v2/auth`
- `https://oauth2.googleapis.com/token`
- `https://www.googleapis.com/oauth2/v2/userinfo`

Cuotas y modelos internos:
- `https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`
- `https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- `https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`

Gemini API:
- `https://generativelanguage.googleapis.com/v1beta`

Actualizacion y user agent:
- Servicio de actualizaciones publico Electron.
- Resolucion de version y user-agent contra endpoints publicos.

Servicios locales:
- OAuth local: `http://localhost:8888/oauth-callback`
- Proxy local: `http://127.0.0.1:<proxy_port>` (configurable)

Proxy upstream:
- Si `upstream_proxy` esta habilitado, las solicitudes HTTP usan ProxyAgent.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\geminiClient.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\request-user-agent.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\config\manager.ts`
