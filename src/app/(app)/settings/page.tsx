"use client";

import { useEffect, useState } from "react";
import { LIVE_MODEL_FALLBACK_CHAIN, DEFAULT_LIVE_MODEL_ID } from "@/lib/models";

type SettingsResponse = {
  hasApiKey: boolean;
  maskedKey: string | null;
  preferredModel: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [preferredModel, setPreferredModel] = useState(DEFAULT_LIVE_MODEL_ID);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-key")
      .then((res) => res.json())
      .then((data: SettingsResponse) => {
        setSettings(data);
        setPreferredModel(data.preferredModel ?? DEFAULT_LIVE_MODEL_ID);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, preferredModel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Could not save your API key." });
        return;
      }
      setSettings({ hasApiKey: true, maskedKey: data.maskedKey, preferredModel });
      setApiKey("");
      setMessage({ type: "success", text: "API key saved." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Your Gemini API key is used only for your own sessions.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Gemini API key</p>
        {loading ? (
          <p className="mt-2 text-sm text-muted">Loading…</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {settings?.hasApiKey ? `Currently set: ${settings.maskedKey}` : "No API key on file yet."}
          </p>
        )}

        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {settings?.hasApiKey ? "Replace API key" : "API key"}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
              autoComplete="off"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Preferred Live model
            <select
              value={preferredModel}
              onChange={(e) => setPreferredModel(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            >
              {LIVE_MODEL_FALLBACK_CHAIN.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.approxTpm})
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              If this model hits a rate limit mid-session, we automatically fall back to the next one.
            </span>
          </label>

          {message && (
            <p className={`text-sm ${message.type === "error" ? "text-danger" : "text-accent"}`}>{message.text}</p>
          )}

          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
