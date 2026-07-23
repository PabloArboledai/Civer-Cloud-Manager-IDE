import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldAlert, Wifi, Globe, Cpu, Server, Network, Radar } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useConfigStore } from '../stores/useConfigStore';

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

export default function NetworkMonitor() {
  const { t } = useTranslation();
  const { config } = useConfigStore();
  const graphRef = useRef<any>(null);
  
  // Real-time graph data state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [metrics, setMetrics] = useState({
    activeNodes: 0,
    meshTraffic: 0,
    avgLatency: 0,
    syncStatus: 'Optimal'
  });

  const isDark = config?.theme === 'dark';

  // Cyberpunk/Hacker Theme Colors
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

  // Mock initial data (since Tauri IPC isn't fully streaming it yet)
  // In a real scenario, this would be updated via listen('p2p://mesh-update')
  useEffect(() => {
    const initialNodes: Node[] = [
      { id: 'laptop', name: 'Laptop-ThinkPad (Local)', group: 1, val: 20, status: 'online', ip: '100.96.218.12', type: 'Manager' },
      { id: 'hpone', name: 'HP One (Linux Server)', group: 2, val: 30, status: 'syncing', ip: '100.104.166.73', type: 'Core Node' },
      { id: 'vps', name: 'VPS Cloud (Civer)', group: 2, val: 25, status: 'online', ip: 'status.civer.cloud', type: 'Gateway' },
      { id: 'peer1', name: 'Peer-AB29 (Yggdrasil)', group: 3, val: 10, status: 'online', type: 'Relay' },
      { id: 'peer2', name: 'Peer-F9C1 (Libp2p)', group: 3, val: 10, status: 'online', type: 'Relay' },
      { id: 'mobile', name: 'Android Agent', group: 4, val: 15, status: 'offline', type: 'Mobile' }
    ];

    const initialLinks: Link[] = [
      { source: 'laptop', target: 'hpone', latency: 45, protocol: 'Tailscale/Syncthing' },
      { source: 'laptop', target: 'vps', latency: 120, protocol: 'Libp2p' },
      { source: 'hpone', target: 'vps', latency: 85, protocol: 'Yggdrasil' },
      { source: 'hpone', target: 'peer1', latency: 15, protocol: 'Yggdrasil' },
      { source: 'vps', target: 'peer2', latency: 30, protocol: 'Libp2p' },
      { source: 'laptop', target: 'mobile', latency: 0, protocol: 'Offline' }
    ];

    setGraphData({ nodes: initialNodes, links: initialLinks });
    
    // Simulate real-time metrics changing
    const interval = setInterval(() => {
      setMetrics({
        activeNodes: Math.floor(Math.random() * 3) + 4,
        meshTraffic: Math.floor(Math.random() * 500) + 100, // MB/s
        avgLatency: Math.floor(Math.random() * 40) + 30, // ms
        syncStatus: Math.random() > 0.8 ? 'Syncing...' : 'Optimal'
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col relative w-full overflow-hidden bg-[#faf8f5] dark:bg-[#0a0f19]">
      {/* Background Grid Pattern (Cyberpunk vibe) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `linear-gradient(${colors.primary} 1px, transparent 1px), linear-gradient(90deg, ${colors.primary} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Header Overlay */}
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
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Mesh Traffic</span>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
                <span className="text-xl font-mono font-bold dark:text-gray-100">{metrics.meshTraffic} MB/s</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Avg Latency</span>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-500" />
                <span className="text-xl font-mono font-bold dark:text-gray-100">{metrics.avgLatency} ms</span>
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
        
        {/* Status indicator */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm pointer-events-auto shadow-lg shadow-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">P2P Network Active</span>
        </div>
      </div>

      {/* Force Graph Area */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        {graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={window.innerWidth}
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
              
              // Draw node glow (Cyberpunk effect)
              if (isDark) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = node.status === 'online' ? colors.nodeOnline : colors.nodeOffline;
              }
              
              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.status === 'online' ? colors.nodeOnline : 
                             node.status === 'syncing' ? colors.nodeSyncing : colors.nodeOffline;
              ctx.fill();
              
              ctx.shadowBlur = 0;

              // Draw label background
              ctx.font = `bold ${fontSize}px Inter, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

              ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)';
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + node.val / 2 + 2, bckgDimensions[0], bckgDimensions[1]);

              // Draw text
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = colors.text;
              ctx.fillText(label, node.x, node.y + node.val / 2 + 2 + fontSize / 2);
              
              // Draw subtext (IP)
              if (node.ip && globalScale > 1.5) {
                ctx.font = `${fontSize * 0.8}px monospace`;
                ctx.fillStyle = isDark ? colors.primary : '#0062ff';
                ctx.fillText(node.ip, node.x, node.y + node.val / 2 + 4 + fontSize * 1.5);
              }
            }}
            onNodeClick={(node) => {
              // Center view on node
              graphRef.current?.centerAt(node.x, node.y, 1000);
              graphRef.current?.zoom(2, 2000);
            }}
          />
        )}
      </div>
      
      {/* Legend / Overlay Bottom */}
      <div className="absolute bottom-6 left-6 right-6 z-10 pointer-events-none flex justify-between items-end">
        <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md border border-[#e8e0d5] dark:border-gray-800 p-4 rounded-xl shadow-lg pointer-events-auto">
          <h3 className="text-sm font-bold mb-2 dark:text-gray-200 uppercase tracking-wider">Node Legend</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.nodeOnline, boxShadow: isDark ? `0 0 8px ${colors.nodeOnline}` : 'none' }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">Online & Synchronized</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.nodeSyncing, boxShadow: isDark ? `0 0 8px ${colors.nodeSyncing}` : 'none' }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">Syncing Data (Accounts/Brain)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.nodeOffline, boxShadow: isDark ? `0 0 8px ${colors.nodeOffline}` : 'none' }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">Offline / Disconnected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
