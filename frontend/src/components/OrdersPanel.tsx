import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Order, OrderCreate, OrderStatus } from "../types/api";

const STATUSES: OrderStatus[] = ["pending", "processing", "completed", "cancelled"];

interface Props {
  refreshKey: number;
  onToast?: (msg: string, kind?: "success" | "error") => void;
}

const statusBadge = (s: OrderStatus) => {
  switch (s) {
    case "pending":
      return "badge-pending";
    case "processing":
      return "badge-processing";
    case "completed":
      return "badge-completed";
    case "cancelled":
      return "badge-cancelled";
  }
};

const confidenceBadge = (c: string | null) => {
  if (c === "high") return "badge-high";
  if (c === "medium") return "badge-medium";
  return "badge-low";
};

export function OrdersPanel({ refreshKey, onToast }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [form, setForm] = useState<OrderCreate>({
    patient_first_name: "",
    patient_last_name: "",
    patient_dob: "",
    status: "pending",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listOrders({
        limit: 100,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setOrders(r.items);
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: OrderCreate = {
        ...form,
        patient_dob: form.patient_dob || null,
        notes: form.notes || null,
      };
      await api.createOrder(payload);
      setForm({
        patient_first_name: "",
        patient_last_name: "",
        patient_dob: "",
        status: "pending",
        notes: "",
      });
      onToast?.("Order created", "success");
      await load();
    } catch (e) {
      onToast?.((e as Error).message, "error");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (o: Order) => {
    setEditingId(o.id);
    setEditForm({ ...o });
  };

  const saveEdit = async () => {
    if (!editForm || !editingId) return;
    try {
      await api.updateOrder(editingId, {
        patient_first_name: editForm.patient_first_name,
        patient_last_name: editForm.patient_last_name,
        patient_dob: editForm.patient_dob || null,
        status: editForm.status,
        notes: editForm.notes || null,
      });
      onToast?.("Order updated", "success");
      setEditingId(null);
      setEditForm(null);
      await load();
    } catch (e) {
      onToast?.((e as Error).message, "error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    try {
      await api.deleteOrder(id);
      onToast?.("Order deleted", "success");
      await load();
    } catch (e) {
      onToast?.((e as Error).message, "error");
    }
  };

  return (
    <>
      <div className="card">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Create Order</h2>
        <form onSubmit={create}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="field-label">First name *</label>
              <input
                className="input"
                required
                value={form.patient_first_name}
                onChange={(e) =>
                  setForm({ ...form, patient_first_name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label">Last name *</label>
              <input
                className="input"
                required
                value={form.patient_last_name}
                onChange={(e) =>
                  setForm({ ...form, patient_last_name: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label">Date of birth</label>
              <input
                className="input"
                type="date"
                value={form.patient_dob ?? ""}
                onChange={(e) => setForm({ ...form, patient_dob: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="field-label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as OrderStatus })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label className="field-label">Notes</label>
            <textarea
              className="input min-h-[70px] resize-y"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <button className="btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base font-semibold text-slate-900">Orders</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <select
              className="input w-44"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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

        {orders.length === 0 && !loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No orders yet. Create one above or upload a PDF.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-2.5">Patient</th>
                  <th className="border-b border-slate-200 px-3 py-2.5">DOB</th>
                  <th className="border-b border-slate-200 px-3 py-2.5">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2.5">Source</th>
                  <th className="border-b border-slate-200 px-3 py-2.5">Created</th>
                  <th className="border-b border-slate-200 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) =>
                  editingId === o.id && editForm ? (
                    <tr key={o.id} className="bg-amber-50/40">
                      <td className="border-b border-slate-200 px-3 py-2.5">
                        <div className="flex gap-1">
                          <input
                            className="input w-28"
                            value={editForm.patient_first_name}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                patient_first_name: e.target.value,
                              })
                            }
                          />
                          <input
                            className="input w-28"
                            value={editForm.patient_last_name}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                patient_last_name: e.target.value,
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5">
                        <input
                          className="input"
                          type="date"
                          value={editForm.patient_dob ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, patient_dob: e.target.value })
                          }
                        />
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5">
                        <select
                          className="input"
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              status: e.target.value as OrderStatus,
                            })
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                        {o.source_document_name ?? "—"}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 text-slate-500">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5">
                        <div className="flex gap-1.5">
                          <button className="btn-primary" onClick={saveEdit}>
                            Save
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setEditingId(null);
                              setEditForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top">
                        <div className="font-semibold text-slate-900">
                          {o.patient_first_name} {o.patient_last_name}
                        </div>
                        {o.notes && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {o.notes}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top">
                        {o.patient_dob ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top">
                        <span className={statusBadge(o.status)}>{o.status}</span>
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top text-slate-500">
                        {o.source_document_name ?? "—"}
                        {o.extraction_confidence && (
                          <>
                            {" "}
                            <span className={confidenceBadge(o.extraction_confidence)}>
                              {o.extraction_confidence}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top text-slate-500">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2.5 align-top">
                        <div className="flex gap-1.5">
                          <button
                            className="btn-secondary"
                            onClick={() => startEdit(o)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => remove(o.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
