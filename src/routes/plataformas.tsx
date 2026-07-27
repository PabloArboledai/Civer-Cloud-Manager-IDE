import { createFileRoute } from '@tanstack/react-router'
import { Server, Globe, Shield, Zap } from 'lucide-react'

export const Route = createFileRoute('/plataformas')({
  component: PlataformasComponent,
})

function PlataformasComponent() {
  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plataformas</h1>
          <p className="text-muted-foreground mt-1">
            Centro de mando para Cloudflare, DNS, Túneles y Telemetría.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Dominio / Zonas */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Dominios</h3>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Zonas gestionadas en Cloudflare
            </p>
          </div>
        </div>

        {/* Túneles Zero Trust */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Túneles</h3>
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Conexiones de malla activas
            </p>
          </div>
        </div>

        {/* Caché */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Caché & Edge</h3>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">Activo</div>
            <p className="text-xs text-muted-foreground">
              Development Mode: Off
            </p>
          </div>
        </div>

        {/* SSL / Seguridad */}
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Seguridad</h3>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">Estricto</div>
            <p className="text-xs text-muted-foreground">
              Cifrado Full (strict)
            </p>
          </div>
        </div>
      </div>
      
      {/* Espacio para los submódulos futuros (DNS, etc) */}
      <div className="flex-1 rounded-xl border border-dashed flex items-center justify-center p-8 bg-muted/10">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Módulos en construcción</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Aquí se integrarán las tablas de DNS y el dashboard de telemetría en tiempo real.
          </p>
        </div>
      </div>
    </div>
  )
}
