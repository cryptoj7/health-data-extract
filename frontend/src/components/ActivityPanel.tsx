import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ActivityLog } from "../types/api";

interface Props {
  refreshKey: number;
}

const statusBadge = (code: number) => {
  if (code < 300) return "badge-completed";
  if (code < 400) return "badge-processing";
  if (code < 500) return "badge-pending";
  return "badge-cancelled";
};

export function ActivityPanel({ refreshKey }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathFilter, setPathFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listActivityLogs({
        limit: 100,
        pathContains: pathFilter || undefined,
      });
      setLogs(r.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-slate-900">Activity Log</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-56"
            placeholder="Filter by path…"
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {logs.length === 0 && !loading ? (
        <div className="py-10 text-center text-sm text-slate-500">No activity yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2.5">Time</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Method</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Path</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Status</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Duration</th>
                <th className="border-b border-slate-200 px-3 py-2.5">Actor</th>
                <th className="border-b border-slate-200 px-3 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {l.method}
                    </code>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {l.path}
                    </code>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5">
                    <span className={statusBadge(l.status_code)}>
                      {l.status_code}
                    </span>
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                    {l.duration_ms} ms
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                    {l.actor ?? "—"}
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                    {l.client_ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
