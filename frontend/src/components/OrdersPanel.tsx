import { Fragment, useEffect, useState } from "react";
import { api } from "../lib/api";
import { DocumentDetailsView } from "./DocumentDetailsView";
import type { Order, OrderCreate, OrderStatus, OrderedItem } from "../types/api";

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

function PdfIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function OriginCell({ order }: { order: Order }) {
  // Extracted orders carry an extraction_confidence (set when the upload
  // endpoint persists them). Hand-created orders never have it.
  if (order.extraction_confidence) {
    return (
      <div className="flex items-center gap-1.5">
        <PdfIcon className="h-4 w-4 text-brand-700" />
        <span className={confidenceBadge(order.extraction_confidence)}>
          {order.extraction_confidence}
        </span>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-semibold tracking-wider text-ink-600 uppercase">
      Manual
    </span>
  );
}

function describeItem(item: OrderedItem): string {
  // Prefer description; fall back to code; fall back to a placeholder.
  const desc = (item.description || "").trim();
  const code = (item.code || "").trim();
  if (desc && code) return `${code} · ${desc}`;
  return desc || code || "(unnamed item)";
}

function ItemsCell({ order }: { order: Order }) {
  const items = order.document_metadata?.items ?? [];
  if (items.length === 0) {
    return <span className="text-ink-400">—</span>;
  }
  const first = items[0];
  const more = items.length - 1;
  return (
    <div className="flex max-w-xs items-center gap-1.5">
      <span
        className="truncate text-ink-900"
        title={items.map(describeItem).join("\n")}
      >
        {describeItem(first)}
      </span>
      {more > 0 && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">
          +{more}
        </span>
      )}
    </div>
  );
}

export function OrdersPanel({ refreshKey, onToast }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

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
      setShowCreate(false);
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Orders</h1>
          <p className="mt-1 text-sm text-ink-500">
            Patient orders extracted from documents or created manually.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Close" : "+ New order"}
        </button>
      </div>

      {showCreate && (
        <div className="card mb-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">
            Create order
          </h2>
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
                  onChange={(e) =>
                    setForm({ ...form, patient_dob: e.target.value })
                  }
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
            <div className="mt-4 flex gap-2">
              <button className="btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create order"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
          <span className="text-sm text-ink-500">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {orders.length === 0 && !loading ? (
          <div className="py-12 text-center">
            <div className="text-base font-medium text-ink-700">No orders yet</div>
            <div className="mt-1 text-sm text-ink-500">
              Create one above or upload a PDF.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="border-b border-ink-200 py-3 pr-3 w-6"></th>
                  <th className="border-b border-ink-200 py-3 pr-3">Patient</th>
                  <th className="border-b border-ink-200 py-3 pr-3">DOB</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Status</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Origin</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Items</th>
                  <th className="border-b border-ink-200 py-3 pr-3">Created</th>
                  <th className="border-b border-ink-200 py-3 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) =>
                  editingId === o.id && editForm ? (
                    <tr key={o.id} className="bg-amber-50/40">
                      <td className="border-b border-ink-100 py-3 pr-3"></td>
                      <td className="border-b border-ink-100 py-3 pr-3">
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
                      <td className="border-b border-ink-100 py-3 pr-3">
                        <input
                          className="input"
                          type="date"
                          value={editForm.patient_dob ?? ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              patient_dob: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3">
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
                      <td className="border-b border-ink-100 py-3 pr-3 text-ink-500">
                        {o.source_document_name ?? "—"}
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3 text-ink-400">—</td>
                      <td className="border-b border-ink-100 py-3 pr-3 text-ink-500">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="border-b border-ink-100 py-3 pr-3">
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
                    <Fragment key={o.id}>
                      <tr
                        className={`cursor-pointer transition-colors hover:bg-ink-50/60 ${
                          expandedId === o.id ? "bg-brand-50/40" : ""
                        }`}
                        onClick={() => toggleExpand(o.id)}
                      >
                        <td className="border-b border-ink-100 py-3 pr-3 align-top text-ink-400">
                          {expandedId === o.id ? "▾" : "▸"}
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top">
                          <div className="font-semibold text-ink-900">
                            {o.patient_first_name} {o.patient_last_name}
                          </div>
                          {o.notes && (
                            <div className="mt-0.5 text-xs text-ink-500">
                              {o.notes}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top text-ink-700">
                          {o.patient_dob ?? <span className="text-ink-400">—</span>}
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top">
                          <span className={statusBadge(o.status)}>{o.status}</span>
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top">
                          <OriginCell order={o} />
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top text-sm">
                          <ItemsCell order={o} />
                        </td>
                        <td className="border-b border-ink-100 py-3 pr-3 align-top text-ink-500 whitespace-nowrap">
                          {new Date(o.created_at).toLocaleString()}
                        </td>
                        <td
                          className="border-b border-ink-100 py-3 pr-3 align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="btn-ghost"
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
                      {expandedId === o.id && (
                        <tr>
                          <td
                            colSpan={8}
                            className="border-b border-ink-100 bg-ink-50/40 px-4 py-4"
                          >
                            {o.source_document_name && (
                              <div className="mb-4 flex items-center gap-2 text-sm">
                                <PdfIcon className="h-4 w-4 text-brand-700" />
                                <span className="text-ink-500">Source file:</span>
                                <span className="font-medium text-ink-900">
                                  {o.source_document_name}
                                </span>
                              </div>
                            )}
                            {o.document_metadata ? (
                              <DocumentDetailsView details={o.document_metadata} />
                            ) : (
                              <div className="text-sm text-ink-500">
                                No extracted document details for this order.
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
