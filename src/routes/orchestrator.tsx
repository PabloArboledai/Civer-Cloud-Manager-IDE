import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Server, Play, Square, RefreshCw, Trash2, Folder, Globe, Shield, TerminalSquare, FolderOpen } from 'lucide-react';
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
        // Auto-fill app name from directory name if empty
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
      toast({ title: 'Tunnel Started', description: `Cloudflared tunnel ${tunnelName} is initializing in PM2.` });
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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Orchestrator</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={refreshStatus} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running Watchdogs</CardTitle>
            <Server className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processes.filter(p => p.status === 'online').length}</div>
            <p className="text-muted-foreground text-xs">Active Background Processes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cloudflared Daemon</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cloudflaredRunning ? <span className="text-green-500">Active</span> : <span className="text-red-500">Offline</span>}
            </div>
            <p className="text-muted-foreground text-xs">Zero Trust Connectivity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Process Spawner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" />
              Deploy App / Watchdog
            </CardTitle>
            <CardDescription>Launch a new web application from source folder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">App Name (PM2)</label>
                    <Input value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g. mi-app-web" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Local Port</label>
                    <Input value={appPort} onChange={e => setAppPort(e.target.value)} placeholder="e.g. 3000" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium">Source Directory</label>
                <div className="flex gap-2">
                  <Input value={appDir} onChange={e => setAppDir(e.target.value)} placeholder="C:\ProyectoCiverCloudUnificado\Apps-Web\mi-app-web" />
                  <Button variant="outline" size="icon" onClick={handleSelectDir} title="Select Folder">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleStartApp} disabled={loading || !appName || !appDir}>
               <Play className="mr-2 h-4 w-4" /> Start Application
            </Button>
          </CardFooter>
        </Card>

        {/* Cloudflare Tunnel Controller */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Cloudflare Tunnels
            </CardTitle>
            <CardDescription>Manage your zero-trust internet exposure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Tunnel Name</label>
                    <Input value={tunnelName} onChange={e => setTunnelName(e.target.value)} placeholder="e.g. tunel-omniverso" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Bind Domain</label>
                    <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. app.midominio.com" />
                </div>
             </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-2">
            <Button variant="secondary" className="flex-1" onClick={handleRouteTunnel} disabled={loading || !tunnelName || !domain}>
               Route DNS
            </Button>
            <Button className="flex-1" onClick={handleStartTunnel} disabled={loading || !tunnelName}>
               <Play className="mr-2 h-4 w-4" /> Start Tunnel
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Active Processes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5" />
            Active PM2 Watchdogs
          </CardTitle>
          <CardDescription>Manage currently running background tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          {processes.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No processes are currently running in PM2.
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">PID</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Memory</th>
                    <th className="p-4 font-medium">CPU</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((proc) => (
                    <tr key={proc.name} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{proc.name}</td>
                      <td className="p-4 text-muted-foreground">{proc.pid}</td>
                      <td className="p-4">
                        <Badge variant={proc.status === 'online' ? 'default' : 'secondary'} className={proc.status === 'online' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''}>
                          {proc.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{proc.memory}</td>
                      <td className="p-4 text-muted-foreground">{proc.cpu}</td>
                      <td className="p-4 text-right">
                         <div className="flex justify-end gap-2">
                           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAction('restart', proc.name)} title="Restart">
                             <RefreshCw className="h-4 w-4" />
                           </Button>
                           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleAction('stop', proc.name)} title="Stop">
                             <Square className="h-4 w-4" />
                           </Button>
                           <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleAction('delete', proc.name)} title="Delete">
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
