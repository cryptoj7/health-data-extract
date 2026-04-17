import { useRef, useState } from "react";
import { api } from "../lib/api";
import type { ExtractionResponse } from "../types/api";

interface Props {
  onOrderCreated?: () => void;
  onToast?: (msg: string, kind?: "success" | "error") => void;
  onViewOrders?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const confidenceClass = (c: string) => {
  if (c === "high") return "badge-high";
  if (c === "medium") return "badge-medium";
  return "badge-low";
};

export function UploadPanel({ onOrderCreated, onToast, onViewOrders }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createOrder, setCreateOrder] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.extractPdf(file, createOrder);
      setResult(r);
      if (createOrder && r.order_id) {
        onToast?.("Order created from extraction", "success");
        onOrderCreated?.();
      } else {
        onToast?.("Extraction complete", "success");
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      onToast?.(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Extract patient data from a PDF
        </h1>
        <p className="mt-3 text-base text-ink-600">
          Drop a medical order and we&apos;ll pull out the patient&apos;s name and
          date of birth.
        </p>
      </div>

      <div className="card">
        <div
          className={`group relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            dragging
              ? "border-brand-500 bg-brand-50"
              : "border-ink-200 hover:border-brand-400 hover:bg-brand-50/40"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-semibold text-ink-900">{file.name}</div>
                <div className="text-sm text-ink-500">{formatBytes(file.size)}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 transition-transform group-hover:scale-105">
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="font-semibold text-ink-900">
                Drop a PDF here, or click to browse
              </div>
              <div className="mt-1 text-sm text-ink-500">
                Up to 10 MB. Scanned and digital PDFs both supported.
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={createOrder}
            onChange={(e) => setCreateOrder(e.target.checked)}
          />
          Save the extracted patient as a new order
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            className="btn-primary px-6 py-3 text-base"
            disabled={!file || uploading}
            onClick={upload}
          >
            {uploading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    strokeLinecap="round"
                  />
                </svg>
                Extracting…
              </>
            ) : (
              "Extract patient data"
            )}
          </button>
          {file && (
            <button
              className="btn-secondary"
              type="button"
              disabled={uploading}
              onClick={reset}
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card mt-6 border-l-4 border-l-emerald-500">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="m-0 text-base font-semibold text-ink-900">
                Extraction complete
              </h2>
            </div>
            {result.order_id && onViewOrders && (
              <button
                className="btn-secondary"
                type="button"
                onClick={onViewOrders}
              >
                View in Orders →
              </button>
            )}
          </div>

          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
            <dt className="font-semibold text-ink-500">First name</dt>
            <dd className="text-ink-900">
              {result.extracted.first_name ?? (
                <span className="text-ink-400">—</span>
              )}
            </dd>
            <dt className="font-semibold text-ink-500">Last name</dt>
            <dd className="text-ink-900">
              {result.extracted.last_name ?? (
                <span className="text-ink-400">—</span>
              )}
            </dd>
            <dt className="font-semibold text-ink-500">Date of birth</dt>
            <dd className="text-ink-900">
              {result.extracted.date_of_birth ?? (
                <span className="text-ink-400">—</span>
              )}
            </dd>
            <dt className="font-semibold text-ink-500">Confidence</dt>
            <dd className="flex items-center gap-2">
              <span className={confidenceClass(result.extracted.confidence)}>
                {result.extracted.confidence}
              </span>
              <span className="text-ink-500">via {result.extracted.source}</span>
            </dd>
            {result.order_id && (
              <>
                <dt className="font-semibold text-ink-500">Order ID</dt>
                <dd>
                  <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700">
                    {result.order_id}
                  </code>
                </dd>
              </>
            )}
          </dl>

          {result.raw_text_preview && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-900">
                Document text preview
              </h3>
              <pre className="max-h-56 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs whitespace-pre-wrap break-words text-ink-700">
                {result.raw_text_preview}
              </pre>
            </>
          )}
        </div>
      )}
    </>
  );
}
