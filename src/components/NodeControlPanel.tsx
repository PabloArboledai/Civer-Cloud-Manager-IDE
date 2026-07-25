import React, { useState } from 'react';
import { X, Play, Square, Download, Trash2, Terminal, Monitor, FileUp, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

export interface TelemetryEvent {
  node_name: string;
  ip: string;
  status: string;
  latency_ms: number;
  bandwidth_mbps: number;
  protocol: string;
  sync_status: string;
  app_installed?: boolean;
  app_running?: boolean;
  os_type?: string;
  supported_protocols?: string[];
}

interface NodeControlPanelProps {
  node: TelemetryEvent;
  onClose: () => void;
  isDark: boolean;
}

export function NodeControlPanel({ node, onClose, isDark }: NodeControlPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoadingAction(action);
    try {
      const res = await invoke<string>('mesh_execute_action', { 
        ip: node.ip === 'localhost' || node.ip === '127.0.0.1' ? '127.0.0.1' : node.ip, 
        action, 
        payload: null 
      });
      toast.success(`Action sent to ${node.node_name}`, { description: res });
    } catch (e: any) {
      toast.error(`Failed to execute action`, { description: String(e) });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="absolute right-6 top-32 w-80 shadow-2xl rounded-2xl border backdrop-blur-xl z-50 flex flex-col overflow-hidden transition-all duration-300 bg-white/90 dark:bg-[#0f172a]/90 dark:border-cyan-900/50">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center dark:border-cyan-900/50">
        <div>
          <h3 className="font-bold text-lg leading-tight">{node.node_name}</h3>
          <p className="text-xs font-mono opacity-70 mt-1">{node.ip}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        
        {/* State */}
        <div>
          <h4 className="text-xs uppercase font-semibold opacity-50 mb-2">System State</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded-lg border dark:border-gray-800">
              <span className="block text-xs opacity-60">OS</span>
              <span className="font-medium">{node.os_type || 'Unknown'}</span>
            </div>
            <div className="p-2 rounded-lg border dark:border-gray-800">
              <span className="block text-xs opacity-60">Status</span>
              <span className="font-medium">{node.status}</span>
            </div>
          </div>
        </div>

        {/* Application Controls */}
        <div>
          <h4 className="text-xs uppercase font-semibold opacity-50 mb-2">Application</h4>
          <div className="space-y-2">
            {!node.app_installed ? (
              <button 
                onClick={() => handleAction('INSTALL_APP')}
                disabled={loadingAction !== null}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all`}
              >
                <div className="flex items-center gap-3">
                  <Download className={isDark ? 'text-cyan-400' : 'text-blue-500'} size={18} />
                  <span className="font-medium text-sm">Instalar vía Mesh</span>
                </div>
                {loadingAction === 'INSTALL_APP' && <Loader2 size={14} className="animate-spin" />}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => handleAction(node.app_running ? 'STOP_APP' : 'START_APP')}
                  disabled={loadingAction !== null}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all`}
                >
                  <div className="flex items-center gap-3">
                    {node.app_running ? (
                      <Square className={isDark ? 'text-amber-400' : 'text-amber-500'} size={18} />
                    ) : (
                      <Play className={isDark ? 'text-emerald-400' : 'text-emerald-500'} size={18} />
                    )}
                    <span className="font-medium text-sm">{node.app_running ? 'Detener Proceso' : 'Iniciar Proceso'}</span>
                  </div>
                  {loadingAction?.includes('_APP') && <Loader2 size={14} className="animate-spin" />}
                </button>
                
                <button 
                  onClick={() => handleAction('UNINSTALL_APP')}
                  disabled={loadingAction !== null}
                  className="w-full flex items-center justify-between p-3 rounded-lg border transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className={isDark ? 'text-red-400' : 'text-red-500'} size={18} />
                    <span className="font-medium text-sm">Desinstalar Aplicación</span>
                  </div>
                </button>

                <button 
                  onClick={() => handleAction('UPDATE_APP')}
                  disabled={loadingAction !== null}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <Download className={isDark ? 'text-blue-400' : 'text-blue-500'} size={18} />
                    <span className="font-medium text-sm">Actualizar Aplicación</span>
                  </div>
                  {loadingAction === 'UPDATE_APP' && <Loader2 size={14} className="animate-spin" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Protocol Access */}
        {(node.supported_protocols && node.supported_protocols.length > 0) && (
          <div>
            <h4 className="text-xs uppercase font-semibold opacity-50 mb-2">Remote Access</h4>
            <div className="grid grid-cols-2 gap-2">
              {node.supported_protocols.includes('RDP') && (
                <button 
                  onClick={() => handleAction('CONNECT_RDP')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Monitor size={20} className="mb-2 opacity-80" />
                  <span className="text-xs font-bold">RDP</span>
                </button>
              )}
              {node.supported_protocols.includes('SSH') && (
                <button 
                  onClick={() => handleAction('CONNECT_SSH')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Terminal size={20} className="mb-2 opacity-80" />
                  <span className="text-xs font-bold">SSH</span>
                </button>
              )}
              {node.supported_protocols.includes('FTP') && (
                <button 
                  onClick={() => handleAction('CONNECT_FTP')}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <FileUp size={20} className="mb-2 opacity-80" />
                  <span className="text-xs font-bold">FTP</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}