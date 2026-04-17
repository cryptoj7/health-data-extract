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
    <div className="card">
      <h2 className="mb-2 text-base font-semibold text-slate-900">API Connection</h2>
      <p className="mb-4 text-sm text-slate-500">
        Configure the API base URL (leave blank to use the same origin) and your API
        key. Stored locally in your browser only.
      </p>
      <form onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="base" className="field-label">
              API Base URL
            </label>
            <input
              id="base"
              type="text"
              className="input"
              placeholder="https://your-deployment.vercel.app (or blank for same-origin)"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="apikey" className="field-label">
              API Key (X-API-Key)
            </label>
            <input
              id="apikey"
              type="password"
              className="input"
              placeholder="Required if REQUIRE_AUTH=true"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" type="submit">
            Save
          </button>
          {saved && <span className="text-sm text-slate-500">Saved</span>}
        </div>
      </form>
    </div>
  );
}
