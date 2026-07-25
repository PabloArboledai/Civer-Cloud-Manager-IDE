import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Server, Network, Radar, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useConfigStore } from '../stores/useConfigStore';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { NodeControlPanel } from '../components/NodeControlPanel';

interface Node {
  id: string;
  name: string;
  group: number;
  val: number;
  status: 'online' | 'syncing' | 'offline';
  ip?: string;
  type?: string;
}

interface Link {
  source: string;
  target: string;
  latency: number;
  protocol: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

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

export default function NetworkMonitor() {
  const { t } = useTranslation();
  const { config } = useConfigStore();
  const graphRef = useRef<any>(null);
  
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryEvent>>({});
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<TelemetryEvent | null>(null);
  const [metrics, setMetrics] = useState({
    activeNodes: 0,
    meshTraffic: 0,
    avgLatency: 0,
    syncStatus: 'Optimal'
  });

  const isDark = config?.theme === 'dark';
  const colors = {
    primary: isDark ? '#00f2fe' : '#0062ff',
    secondary: isDark ? '#fe0979' : '#ff0055',
    background: isDark ? 'rgba(10, 15, 25, 0.8)' : 'rgba(250, 248, 245, 0.8)',
    nodeOnline: isDark ? '#00ffcc' : '#00cc99',
    nodeSyncing: isDark ? '#ffcc00' : '#ff9900',
    nodeOffline: isDark ? '#ff0033' : '#cc0033',
    link: isDark ? 'rgba(0, 242, 254, 0.4)' : 'rgba(0, 98, 255, 0.4)',
    text: isDark ? '#e0e0e0' : '#333333'
  };

  useEffect(() => {
    let isMounted = true;
    
    const setupListener = async () => {
      const unlisten = await listen<TelemetryEvent>('mesh-telemetry', (event) => {
        if (!isMounted) return;
        
        setTelemetry(prev => {
          const prevNode = prev[event.payload.ip];
          
          // Toast notifications logic
          if (!prevNode && event.payload.status === 'ONLINE') {
             toast.success(`Node Connected: ${event.payload.node_name}`, { description: `IP: ${event.payload.ip} connected via ${event.payload.protocol}` });
          } else if (prevNode) {
             if (prevNode.status !== event.payload.status) {
                if (event.payload.status === 'ONLINE') {
                   toast.success(`Node Auto-Recovered: ${event.payload.node_name}`, { description: 'Omni-Watchdog successfully restored connection.' });
                } else {
                   toast.error(`Node Disconnected: ${event.payload.node_name}`, { description: 'Connection lost. Awaiting auto-recovery...' });
                }
             } else if (prevNode.sync_status !== event.payload.sync_status) {
                if (event.payload.sync_status === 'Synced') {
                   toast.info(`Database Synced`, { description: `${event.payload.node_name} is now fully synchronized.` });
                }
             }
          }
          
          return {
            ...prev,
            [event.payload.ip]: event.payload
          };
        });
      });
      return unlisten;
    };
    
    let unlistenFn: any;
    setupListener().then(fn => { unlistenFn = fn; });
    
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    // Rebuild graph data when telemetry updates
    const nodes: Node[] = [];
    const links: Link[] = [];
    
    const dataList = Object.values(telemetry);
    let onlineCount = 0;
    let totalLatency = 0;
    let anyUnsynced = false;

    // Add local node if not present
    if (!dataList.find(d => d.ip === 'localhost')) {
      nodes.push({ id: 'localhost', name: 'Localhost (This PC)', group: 1, val: 25, status: 'online', ip: '127.0.0.1' });
    }

    dataList.forEach(data => {
      const isOnline = data.status === 'ONLINE';
      const isSynced = data.sync_status === 'Synced';
      
      if (isOnline) onlineCount++;
      totalLatency += data.latency_ms;
      if (isOnline && !isSynced) anyUnsynced = true;

      nodes.push({
        id: data.ip,
        name: data.node_name,
        group: 2,
        val: 20,
        status: isOnline ? (isSynced ? 'online' : 'syncing') : 'offline',
        ip: data.ip,
      });

      if (data.ip !== 'localhost' && isOnline) {
        links.push({
          source: 'localhost',
          target: data.ip,
          latency: data.latency_ms,
          protocol: data.protocol
        });
      }
    });

    const newGraphData = { nodes, links };
    
    // Check if graph already exists and mutate it directly to avoid complete re-renders (anti-lag)
    if (graphRef.current) {
        // Just update graphData on the imperative instance
        graphRef.current.graphData(newGraphData);
    } else {
        // Initial set if the graph component hasn't mounted yet
        setGraphData(newGraphData);
    }

    setMetrics({
      activeNodes: onlineCount,
      meshTraffic: onlineCount * 45, // Simulate traffic 
      avgLatency: onlineCount > 0 ? Math.round(totalLatency / onlineCount) : 0,
      syncStatus: anyUnsynced ? 'Syncing...' : 'Optimal'
    });

  }, [telemetry]);

  const telemetryList = Object.values(telemetry);

  return (
    <div className="h-full flex flex-col relative w-full overflow-hidden bg-[#faf8f5] dark:bg-[#0a0f19]">
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `linear-gradient(${colors.primary} 1px, transparent 1px), linear-gradient(90deg, ${colors.primary} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md border border-[#e8e0d5] dark:border-cyan-900/50 p-5 rounded-2xl shadow-xl pointer-events-auto">
          <div className="flex items-center gap-3 mb-4">
            <Radar className="w-8 h-8 text-[#0062ff] dark:text-[#00f2fe]" />
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0062ff] to-[#fe0979] dark:from-[#00f2fe] dark:to-[#fe0979]">
                Quantum Mesh Radar
              </h1>
              <p className="text-sm text-gray-500 dark:text-cyan-400/70">Real-time Topography & Synchronization</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Active Nodes</span>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                <span className="text-xl font-mono font-bold dark:text-gray-100">{metrics.activeNodes}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">DB Sync</span>
              <div className="flex items-center gap-2">
                <Network className={`w-4 h-4 ${metrics.syncStatus === 'Optimal' ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`} />
                <span className="text-md font-bold dark:text-gray-100">{metrics.syncStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing flex flex-col md:flex-row">
        
        {/* Radar Graph */}
        <div className="flex-1 h-1/2 md:h-full relative overflow-hidden">
          {graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={window.innerWidth / (window.innerWidth < 768 ? 1 : 1.5)}
              height={window.innerHeight}
              backgroundColor="transparent"
              nodeRelSize={6}
              nodeColor={(node: any) => {
                if (node.status === 'online') return colors.nodeOnline;
                if (node.status === 'syncing') return colors.nodeSyncing;
                return colors.nodeOffline;
              }}
              linkColor={() => colors.link}
              linkWidth={(link: any) => link.latency === 0 ? 1 : Math.max(1, 5 - link.latency / 40)}
              linkDirectionalParticles={4}
              linkDirectionalParticleWidth={(link: any) => link.latency === 0 ? 0 : 2}
              linkDirectionalParticleSpeed={(link: any) => link.latency === 0 ? 0 : 0.01 + (100 / Math.max(link.latency, 10)) * 0.001}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                
                if (isDark) {
                  ctx.shadowBlur = 10;
                  ctx.shadowColor = node.status === 'online' ? colors.nodeOnline : colors.nodeOffline;
                }
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI, false);
                ctx.fillStyle = node.status === 'online' ? colors.nodeOnline : 
                               node.status === 'syncing' ? colors.nodeSyncing : colors.nodeOffline;
                ctx.fill();
                
                ctx.shadowBlur = 0;
                ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

                ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + node.val / 2 + 2, bckgDimensions[0], bckgDimensions[1]);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = colors.text;
                ctx.fillText(label, node.x, node.y + node.val / 2 + 2 + fontSize / 2);
                
                if (node.ip && globalScale > 1.5) {
                  ctx.font = `${fontSize * 0.8}px monospace`;
                  ctx.fillStyle = isDark ? colors.primary : '#0062ff';
                  ctx.fillText(node.ip, node.x, node.y + node.val / 2 + 4 + fontSize * 1.5);
                }
              }}
              onNodeClick={(node: any) => {
                const telemetryData = telemetry[node.ip];
                if (telemetryData) {
                  setSelectedNode(telemetryData);
                }
              }}
            />
          )}
          {selectedNode && (
             <NodeControlPanel 
               node={selectedNode} 
               onClose={() => setSelectedNode(null)}
               isDark={isDark}
             />
          )}
        </div>

        {/* Real-time Checklist Grid */}
        <div className="flex-1 md:w-1/3 bg-white/90 dark:bg-black/80 backdrop-blur-md border-l border-[#e8e0d5] dark:border-cyan-900/50 p-6 overflow-y-auto z-20">
          <h2 className="text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" /> Mesh Checklist
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Real-time status of Node Connections and Unified Account Synchronization.
          </p>

          <div className="space-y-4">
            {telemetryList.length === 0 && (
              <div className="text-center py-10 opacity-50">Waiting for Mesh Telemetry...</div>
            )}
            {telemetryList.map((tel, idx) => (
              <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm bg-gray-50/50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg dark:text-gray-200">{tel.node_name}</h3>
                  <div className="flex items-center gap-2">
                    {tel.status === 'ONLINE' ? (
                      <span className="badge badge-success gap-1"><CheckCircle2 size={14}/> ONLINE</span>
                    ) : (
                      <span className="badge badge-error gap-1"><XCircle size={14}/> OFFLINE</span>
                    )}
                    <button 
                      onClick={() => setSelectedNode(tel)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all"
                    >
                      Acciones
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-500 block text-xs">IP Address</span>
                    <span className="font-mono dark:text-cyan-400">{tel.ip}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-500 block text-xs">Protocol</span>
                    <span className="font-mono dark:text-cyan-400">{tel.protocol}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-500 block text-xs">Latency</span>
                    <span className="dark:text-gray-300">{tel.status === 'ONLINE' ? `${tel.latency_ms} ms` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-500 block text-xs">Data Sync</span>
                    <div className="flex items-center gap-1 font-semibold">
                      {tel.sync_status === 'Synced' ? (
                        <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={14} /> Synced</span>
                      ) : tel.sync_status === 'Desynchronized' ? (
                         <span className="text-red-500 flex items-center gap-1"><XCircle size={14} /> Out of Sync</span>
                      ) : (
                         <span className="text-amber-500 flex items-center gap-1"><RefreshCw size={14} className="animate-spin" /> {tel.sync_status}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
