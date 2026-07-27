import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Server, Play, Square, RefreshCw, Trash2, Folder, Globe, Shield, TerminalSquare, FolderOpen, Cpu, MemoryStick, Activity } from 'lucide-react';
import { getPM2Status, startPM2App, stopPM2App, restartPM2App, deletePM2App, ProcessStatus, getCloudflaredStatus, startCloudflareTunnel, routeCloudflareTunnel } from '../lib/orchestrator';
import { useToast } from '../components/ui/use-toast';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export const Route = createFileRoute('/orchestrator')({
  component: OrchestratorDashboard,
});

export default function OrchestratorDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [processes, setProcesses] = useState<ProcessStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [cloudflaredRunning, setCloudflaredRunning] = useState(false);
  
  // App Creation State
  const [appName, setAppName] = useState('');
  const [appDir, setAppDir] = useState('C:\\ProyectoCiverCloudUnificado\\Apps-Web\\');
  const [appPort, setAppPort] = useState('3000');
  
  // Tunnel State
  const [tunnelName, setTunnelName] = useState('');
  const [domain, setDomain] = useState('');

  const handleSelectDir = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath: 'C:\\ProyectoCiverCloudUnificado\\Apps-Web\\',
      });
      if (selectedPath && typeof selectedPath === 'string') {
        setAppDir(selectedPath);
        if (!appName) {
          const folderName = selectedPath.split('\\').pop();
          if (folderName) setAppName(folderName);
        }
      }
    } catch (e: any) {
      toast({ title: 'Error selecting directory', description: e.toString(), variant: 'destructive' });
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const pm2List = await getPM2Status();
      setProcesses(pm2List);
      
      const cfStatus = await getCloudflaredStatus();
      setCloudflaredRunning(cfStatus.running);
    } catch (e: any) {
      toast({ title: 'Error fetching status', description: e.toString(), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartApp = async () => {
    if (!appName || !appDir || !appPort) return;
    try {
      setLoading(true);
      await startPM2App(appName, appDir, appPort);
      toast({ title: 'Application Started', description: `${appName} is now running on port ${appPort}` });
      await refreshStatus();
    } catch (e: any) {
      toast({ title: 'Launch Failed', description: e.toString(), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'stop' | 'restart' | 'delete', name: string) => {
    try {
      setLoading(true);
      if (action === 'stop') await stopPM2App(name);
      if (action === 'restart') await restartPM2App(name);
      if (action === 'delete') await deletePM2App(name);
      toast({ title: 'Success', description: `Successfully executed ${action} on ${name}` });
      await refreshStatus();
    } catch (e: any) {
      toast({ title: 'Action Failed', description: e.toString(), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTunnel = async () => {
    if (!tunnelName) return;
    try {
      setLoading(true);
      await startCloudflareTunnel(tunnelName);
      toast({ title: 'Tunnel Started', description: `Cloudflared tunnel ${tunnelName} is initializing.` });
      await refreshStatus();
    } catch (e: any) {
      toast({ title: 'Tunnel Error', description: e.toString(), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRouteTunnel = async () => {
    if (!tunnelName || !domain) return;
    try {
      setLoading(true);
      await routeCloudflareTunnel(tunnelName, domain);
      toast({ title: 'Domain Routed', description: `${domain} routed to ${tunnelName}.` });
    } catch (e: any) {
      toast({ title: 'Routing Error', description: e.toString(), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Plataformas y Orquestador
          </h2>
          <p className="text-muted-foreground mt-2 font-medium">Controla el ciclo de vida de tus microservicios y conectividad segura.</p>
        </div>
        <Button 
          onClick={refreshStatus} 
          variant="outline" 
          size="lg" 
          disabled={loading}
          className="shadow-sm border-primary/20 hover:bg-primary/5 transition-all duration-300"
        >
          <RefreshCw className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar Estado
        </Button>
      </div>

      {/* KPI METRICS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Watchdogs Activos</p>
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Server className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black">{processes.filter(p => p.status === 'online').length}</span>
              <span className="text-sm font-medium text-muted-foreground">/ {processes.length} totales</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-card/50 border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cloudflared</p>
              <div className={`p-2 rounded-full ${cloudflaredRunning ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <Shield className={`h-5 w-5 ${cloudflaredRunning ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-3xl font-black ${cloudflaredRunning ? 'text-emerald-500' : 'text-red-500'}`}>
                {cloudflaredRunning ? 'Protegido' : 'Apagado'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Uso de CPU</p>
              <div className="p-2 bg-purple-500/10 rounded-full">
                <Cpu className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-purple-400">12%</span>
              <span className="text-sm font-medium text-muted-foreground">Promedio</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Memoria RAM</p>
              <div className="p-2 bg-amber-500/10 rounded-full">
                <MemoryStick className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-amber-400">4.2</span>
              <span className="text-sm font-medium text-muted-foreground">GB en uso</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTROLS GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Deploy App */}
        <Card className="border-white/10 shadow-lg overflow-hidden flex flex-col">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Folder className="h-6 w-6 text-blue-500" />
              </div>
              Lanzar Aplicación (PM2)
            </CardTitle>
            <CardDescription className="text-sm">Inicia un nuevo servicio en segundo plano desde el código fuente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 flex-1">
             <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nombre del Servicio</label>
                    <Input className="bg-background/50 border-white/10 focus-visible:ring-blue-500" value={appName} onChange={e => setAppName(e.target.value)} placeholder="Ej: api-backend" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Puerto Local</label>
                    <Input className="bg-background/50 border-white/10 focus-visible:ring-blue-500" value={appPort} onChange={e => setAppPort(e.target.value)} placeholder="Ej: 3000" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Directorio Raíz</label>
                <div className="flex gap-2">
                  <Input className="bg-background/50 border-white/10 focus-visible:ring-blue-500 font-mono text-sm" value={appDir} onChange={e => setAppDir(e.target.value)} placeholder="C:\ProyectoCiverCloudUnificado\..." />
                  <Button variant="secondary" size="icon" className="shrink-0 hover:bg-blue-500/20 hover:text-blue-500" onClick={handleSelectDir} title="Seleccionar Carpeta">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 pt-4 border-t border-white/5">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20" size="lg" onClick={handleStartApp} disabled={loading || !appName || !appDir}>
               <Play className="mr-2 h-5 w-5" /> Iniciar Servicio
            </Button>
          </CardFooter>
        </Card>

        {/* Cloudflare Tunnels */}
        <Card className="border-white/10 shadow-lg overflow-hidden flex flex-col">
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-500" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2.5 bg-orange-500/10 rounded-xl">
                <Globe className="h-6 w-6 text-orange-500" />
              </div>
              Túneles Cloudflare
            </CardTitle>
            <CardDescription className="text-sm">Expone servicios locales a internet mediante Zero-Trust.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 flex-1">
             <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nombre del Túnel</label>
                    <Input className="bg-background/50 border-white/10 focus-visible:ring-orange-500" value={tunnelName} onChange={e => setTunnelName(e.target.value)} placeholder="Ej: tunel-prod" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Dominio Público</label>
                    <Input className="bg-background/50 border-white/10 focus-visible:ring-orange-500" value={domain} onChange={e => setDomain(e.target.value)} placeholder="Ej: app.midominio.com" />
                </div>
             </div>
          </CardContent>
          <CardFooter className="bg-muted/20 pt-4 border-t border-white/5 flex justify-between gap-3">
            <Button variant="outline" size="lg" className="flex-1 border-orange-500/30 hover:bg-orange-500/10 text-orange-400" onClick={handleRouteTunnel} disabled={loading || !tunnelName || !domain}>
               Vincular DNS
            </Button>
            <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-900/20" size="lg" onClick={handleStartTunnel} disabled={loading || !tunnelName}>
               <Play className="mr-2 h-5 w-5" /> Lanzar Túnel
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* PROCESS TABLE */}
      <Card className="border-white/10 shadow-lg">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            Monitoreo en Vivo (PM2)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <TerminalSquare className="h-16 w-16 opacity-20 mb-4" />
              <p className="text-lg font-medium">No hay servicios corriendo actualmente.</p>
              <p className="text-sm opacity-60">Usa el panel superior para lanzar una nueva aplicación.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left border-b border-white/5">
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Servicio</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">PID</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">Estado</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">RAM</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs">CPU</th>
                    <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-xs text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {processes.map((proc) => (
                    <tr key={proc.name} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-base">{proc.name}</td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">{proc.pid}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`px-2.5 py-1 text-xs border ${
                          proc.status === 'online' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${proc.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                          {proc.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium">{proc.memory}</td>
                      <td className="px-6 py-4 font-medium">{proc.cpu}</td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                           <Button variant="secondary" size="icon" className="h-9 w-9 bg-background/50 hover:bg-blue-500/20 hover:text-blue-400" onClick={() => handleAction('restart', proc.name)} title="Reiniciar">
                             <RefreshCw className="h-4 w-4" />
                           </Button>
                           <Button variant="secondary" size="icon" className="h-9 w-9 bg-background/50 hover:bg-orange-500/20 hover:text-orange-400" onClick={() => handleAction('stop', proc.name)} title="Detener">
                             <Square className="h-4 w-4" />
                           </Button>
                           <Button variant="secondary" size="icon" className="h-9 w-9 bg-background/50 hover:bg-red-500/20 hover:text-red-400" onClick={() => handleAction('delete', proc.name)} title="Eliminar">
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
