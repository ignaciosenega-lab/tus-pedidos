import { useState, useEffect, useRef } from "react";
import { useApi } from "../../hooks/useApi";

interface ResourceData {
  cpu: { percent: number; cores: number; loadAvg: number[] };
  memory: { percent: number; used: number; total: number };
  disk: { percent: number; used: number; total: number };
  network: { rxBytesPerSec: number; txBytesPerSec: number };
  uptime: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatBytesSpeed(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function Ring({ percent, color, size = 80 }: { percent: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="opacity-10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function getColor(percent: number): string {
  if (percent < 60) return "#22c55e";
  if (percent < 85) return "#f59e0b";
  return "#ef4444";
}

export default function ResourcesPage() {
  const { apiFetch } = useApi();
  const [data, setData] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchResources() {
    try {
      const res = await apiFetch<ResourceData>("/api/system/resources");
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al obtener recursos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResources();
    intervalRef.current = setInterval(fetchResources, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando recursos...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-6xl">
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cpuColor = getColor(data.cpu.percent);
  const memColor = getColor(data.memory.percent);
  const diskColor = getColor(data.disk.percent);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Recursos del Servidor</h2>
        <p className="text-gray-400">
          Monitoreo en tiempo real — se actualiza cada 5 segundos
          {data.uptime > 0 && (
            <span className="ml-3 text-gray-500">
              Uptime: {formatUptime(data.uptime)}
            </span>
          )}
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Ring percent={data.cpu.percent} color={cpuColor} />
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">CPU</p>
              <p className="text-2xl font-bold text-white">{data.cpu.percent}%</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Load {data.cpu.loadAvg.join(", ")}
              </p>
              <p className="text-xs text-gray-500">{data.cpu.cores} cores</p>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Ring percent={data.memory.percent} color={memColor} />
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Memoria</p>
              <p className="text-2xl font-bold text-white">{data.memory.percent}%</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}
              </p>
            </div>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Ring percent={data.disk.percent} color={diskColor} />
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Disco</p>
              <p className="text-2xl font-bold text-white">{data.disk.percent}%</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {data.disk.total > 0
                  ? `${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}`
                  : "No disponible"}
              </p>
            </div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-[80px] h-[80px] shrink-0 flex flex-col items-center justify-center rounded-full border-2 border-gray-700">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Red</p>
              <div className="flex items-center gap-2 mt-1">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-sm font-semibold text-white">{formatBytesSpeed(data.network.rxBytesPerSec)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-sm font-semibold text-white">{formatBytesSpeed(data.network.txBytesPerSec)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning banner */}
      {(data.cpu.percent > 85 || data.memory.percent > 85 || data.disk.percent > 85) && (
        <div className="mt-4 bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-400 text-sm font-medium">
            Uno o más recursos están por encima del 85%. El servidor podría experimentar problemas de rendimiento.
          </p>
        </div>
      )}
    </div>
  );
}
