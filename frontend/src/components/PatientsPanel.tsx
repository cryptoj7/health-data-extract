import { Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";
import { DocumentDetailsView } from "./DocumentDetailsView";
import type { Order, Patient } from "../types/api";

interface Props {
  refreshKey: number;
  onToast?: (msg: string, kind?: "success" | "error") => void;
}

export function PatientsPanel({ refreshKey, onToast }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [openLoading, setOpenLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listPatients({ limit: 100, search: search || undefined });
      setPatients(r.items);
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

  const togglePatient = async (p: Patient) => {
    if (openId === p.id) {
      setOpenId(null);
      setOpenOrders([]);
      return;
    }
    setOpenId(p.id);
    setOpenOrders([]);
    setOpenLoading(true);
    try {
      const r = await api.listPatientOrders(p.id);
      setOpenOrders(r.items);
    } catch (e) {
      onToast?.((e as Error).message, "error");
    } finally {
      setOpenLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Patients</h1>
          <p className="mt-1 text-sm text-ink-500">
            Unique patients derived from orders. Same first + last + DOB collapses to
            one record so you can see a patient&apos;s entire order history at a glance.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-64"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <button className="btn-secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <span className="text-sm text-ink-500">
            {patients.length} patient{patients.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {patients.length === 0 && !loading ? (
          <div className="py-12 text-center">
            <div className="text-base font-medium text-ink-700">No patients yet</div>
            <div className="mt-1 text-sm text-ink-500">
              Upload a PDF or create an order to populate this list.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="border-b border-ink-200 py-3 pr-3">Patient</th>
                  <th className="border-b border-ink-200 py-3 pr-3">DOB</th>
                  <th className="border-b border-ink-200 py-3 pr-3 text-right">Orders</th>
                  <th className="border-b border-ink-200 py-3 pr-3">First seen</th>
                  <th className="border-b border-ink-200 py-3 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      className={`cursor-pointer transition-colors hover:bg-ink-50/60 ${
                        openId === p.id ? "bg-brand-50/40" : ""
                      }`}
                      onClick={() => togglePatient(p)}
                    >
                      <td className="border-b border-ink-100 py-3 pr-3 align-top font-semibold text-ink-900">
                        {p.first_name} {p.last_name}
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3 align-top text-ink-700">
                        {p.dob ?? <span className="text-ink-400">—</span>}
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3 align-top text-right">
                        <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-brand-100 px-2 text-xs font-semibold text-brand-800">
                          {p.order_count}
                        </span>
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3 align-top text-ink-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3 align-top text-right text-ink-400">
                        {openId === p.id ? "▾" : "▸"}
                      </td>
                    </tr>
                    {openId === p.id && (
                      <tr>
                        <td colSpan={5} className="border-b border-ink-100 bg-ink-50/40 px-4 py-4">
                          {openLoading ? (
                            <div className="text-sm text-ink-500">Loading orders…</div>
                          ) : openOrders.length === 0 ? (
                            <div className="text-sm text-ink-500">
                              No orders for this patient.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {openOrders.map((o) => (
                                <div
                                  key={o.id}
                                  className="rounded-lg border border-ink-200 bg-white p-4"
                                >
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <div className="text-ink-500">
                                      {new Date(o.created_at).toLocaleString()}{" "}
                                      <span className="ml-2">
                                        <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                                          {o.id.slice(0, 8)}
                                        </code>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`badge-${o.status}`}>
                                        {o.status}
                                      </span>
                                      {o.source_document_name && (
                                        <span className="text-xs text-ink-500">
                                          {o.source_document_name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <DocumentDetailsView details={o.document_metadata} />
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
