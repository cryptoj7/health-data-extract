import { useState } from "react";
import { OrdersPanel } from "./components/OrdersPanel";
import { UploadPanel } from "./components/UploadPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { SettingsPanel } from "./components/SettingsPanel";

type Tab = "upload" | "orders" | "activity" | "settings";

interface Toast {
  msg: string;
  kind: "success" | "error";
}

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "orders", label: "Orders" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="13" x2="12" y2="19" />
        <line x1="9" y1="16" x2="15" y2="16" />
      </svg>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("upload");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activityKey, setActivityKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (msg: string, kind: "success" | "error" = "success") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshOrders = () => setRefreshKey((n) => n + 1);
  const refreshActivity = () => setActivityKey((n) => n + 1);
  const goToOrders = () => setTab("orders");

  // Upload screen feels best with a narrower, centered layout. The data screens
  // need width for tables.
  const containerWidth =
    tab === "upload" ? "max-w-2xl" : "max-w-6xl";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
          <button
            onClick={() => setTab("upload")}
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <Logo />
            <span className="text-base font-bold tracking-tight text-ink-900">
              Health Data Extract
            </span>
          </button>

          <nav
            className="flex items-center gap-1"
            role="tablist"
            aria-label="Sections"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={tab === t.id ? "pill-active" : "pill-inactive"}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={`mx-auto ${containerWidth} px-6 pt-10 pb-20`}>
        {tab === "upload" && (
          <UploadPanel
            onOrderCreated={() => {
              refreshOrders();
              refreshActivity();
            }}
            onToast={showToast}
            onViewOrders={goToOrders}
          />
        )}
        {tab === "orders" && (
          <OrdersPanel
            refreshKey={refreshKey}
            onToast={(m, k) => {
              showToast(m, k);
              refreshActivity();
            }}
          />
        )}
        {tab === "activity" && <ActivityPanel refreshKey={activityKey} />}
        {tab === "settings" && <SettingsPanel />}
      </main>

      {toast && (
        <div
          className={`fixed right-6 bottom-6 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
