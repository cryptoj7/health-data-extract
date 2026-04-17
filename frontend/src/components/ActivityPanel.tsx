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
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Activity
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Audit trail of every request handled by the service.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-64"
              placeholder="Filter by path…"
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <button className="btn-secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <span className="text-sm text-ink-500">
            {logs.length} record{logs.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {logs.length === 0 && !loading ? (
          <div className="py-12 text-center text-sm text-ink-500">
            No activity recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="border-b border-ink-200 py-3 pr-3">Time</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Action</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Resource</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Method</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Path</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Status</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Duration</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Actor</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="transition-colors hover:bg-ink-50/60"
                  >
                    <td className="border-b border-ink-100 py-3 pr-3 text-ink-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3">
                      {l.action ? (
                        <span className="font-medium text-ink-900">{l.action}</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3 text-ink-500">
                      {l.resource_type ? (
                        <>
                          <span>{l.resource_type}</span>
                          {l.resource_id && (
                            <code className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700">
                              {l.resource_id.slice(0, 8)}
                            </code>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3">
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700">
                        {l.method}
                      </code>
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3">
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700">
                        {l.path}
                      </code>
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3">
                      <span className={statusBadge(l.status_code)}>
                        {l.status_code}
                      </span>
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3 text-ink-500 whitespace-nowrap">
                      {l.duration_ms} ms
                    </td>
                    <td className="border-b border-ink-100 py-3 pr-3 text-ink-500">
                      {l.actor ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
