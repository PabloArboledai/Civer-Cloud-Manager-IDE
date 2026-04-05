# UI y rutas

Resumen: el renderer define rutas con TanStack Router y componentes React para cuentas, proxy y configuracion. La UI consume datos via ORPC/IPC y muestra estado de cuentas, cuotas, switching y proxy.

Rutas principales:
- `/` lista de cuentas y operaciones de switch, refresh y add.
- `/proxy` estado y configuracion del proxy interno.
- `/settings` configuraciones generales.

Componentes destacados:
- Lista de cuentas cloud con acciones.
- Dialogos de identidad de dispositivo.
- Configuracion de proxy y API key.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\App.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\index.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\proxy.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\settings.tsx`
