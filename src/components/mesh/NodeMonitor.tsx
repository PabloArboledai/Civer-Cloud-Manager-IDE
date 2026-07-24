import React, { useEffect, useState } from "react";
import { MetricsChart } from "./MetricsChart";
import { listen } from "@tauri-apps/api/event";

interface MeshNodeEvent {
  node_name: string;
  status: "ONLINE" | "OFFLINE" | "SYNCING";
  latency_ms: number;
  bandwidth_mbps: number;
}

export function NodeMonitor() {
  const [nodes, setNodes] = useState<Record<string, MeshNodeEvent>>({});
  const [latencyData, setLatencyData] = useState<any[]>([]);

  useEffect(() => {
    // Initial dummy data for the visual helicopter view
    setNodes({
      "vps-windows-core": { node_name: "vps-windows-core", status: "ONLINE", latency_ms: 12, bandwidth_mbps: 850 },
      "hp-one-ubuntu": { node_name: "hp-one-ubuntu", status: "ONLINE", latency_ms: 45, bandwidth_mbps: 120 },
      "modal-gpu-worker-1": { node_name: "modal-gpu-worker-1", status: "SYNCING", latency_ms: 110, bandwidth_mbps: 45 },
    });

    // Listen for real-time events from the Rust Telemetry engine
    const unlisten = listen<MeshNodeEvent>("mesh-telemetry", (event) => {
      const data = event.payload;
      setNodes((prev) => ({ ...prev, [data.node_name]: data }));
      
      setLatencyData((prev) => {
        const newData = [...prev, { time: new Date().toLocaleTimeString(), value: data.latency_ms }];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    });

    // Simulated real-time oscillation until the Rust backend pushes data
    const interval = setInterval(() => {
      setLatencyData((prev) => {
        const newData = [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            value: Math.floor(Math.random() * 20) + 30, // Random 30-50ms ping
          },
        ];
        if (newData.length > 20) newData.shift();
        return newData;
      });
    }, 2000);

    return () => {
      unlisten.then((fn) => fn());
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Helicopter View: Mesh Telemetry
        </h2>
        <div className="badge badge-success gap-2 p-3 shadow-lg shadow-success/20">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          Mesh Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.values(nodes).map((node) => (
          <div
            key={node.node_name}
            className="card bg-base-200/40 backdrop-blur-md border border-base-300 shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
          >
            <div className="card-body p-5">
              <div className="flex justify-between items-start">
                <h3 className="card-title text-sm font-mono text-base-content/80">
                  {node.node_name}
                </h3>
                <div
                  className={`badge badge-sm ${node.status === 'ONLINE' ? 'badge-success' : node.status === 'SYNCING' ? 'badge-warning' : 'badge-error'}`}
                >
                  {node.status}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-base-content/50">Ping Latency</span>
                  <span className="font-mono font-bold text-cyan-400">{node.latency_ms} ms</span>
                </div>
                <progress 
                  className="progress progress-info w-full bg-base-300" 
                  value={Math.min(node.latency_ms, 200)} 
                  max="200"
                ></progress>
                
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-base-content/50">Bandwidth</span>
                  <span className="font-mono font-bold text-purple-400">{node.bandwidth_mbps} Mbps</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <MetricsChart data={latencyData} title="Average Mesh Latency (ms)" color="#22d3ee" />
        <MetricsChart data={latencyData.map(d => ({...d, value: Math.floor(Math.random() * 500) + 100}))} title="Mesh Throughput (Mbps)" color="#c084fc" />
      </div>
    </div>
  );
}
