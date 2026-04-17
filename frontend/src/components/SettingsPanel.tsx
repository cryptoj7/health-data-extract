import { useEffect, useState } from "react";
import { getApiBaseUrl, getApiKey, setApiBaseUrl, setApiKey } from "../lib/api";

interface Props {
  onSaved?: () => void;
}

export function SettingsPanel({ onSaved }: Props) {
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBase(getApiBaseUrl());
    setKey(getApiKey());
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(base.trim());
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Connection settings are stored locally in your browser only.
        </p>
      </div>

      <div className="card">
        <form onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="base" className="field-label">
                Service URL
              </label>
              <input
                id="base"
                type="text"
                className="input"
                placeholder="Leave blank to use the same origin"
                value={base}
                onChange={(e) => setBase(e.target.value)}
              />
              <p className="text-xs text-ink-500">
                Override only if the backend lives on a different host than the UI.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="apikey" className="field-label">
                Access key
              </label>
              <input
                id="apikey"
                type="password"
                className="input"
                placeholder="Required when authentication is enabled"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-ink-500">
                Sent as <code>X-API-Key</code> with every request.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" type="submit">
              Save changes
            </button>
            {saved && (
              <span className="text-sm font-medium text-emerald-700">
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
