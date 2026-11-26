"use client";

import { useEffect, useState } from "react";

type Setting = {
  enabled: boolean;
  url: string;
};

export function FooterTelegramCard() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/admin/cms/footer-telegram")
      .then(async (response) => {
        const data = (await response.json()) as { data?: Setting; error?: string };
        if (response.ok && data.data) {
          setSetting({
            enabled: Boolean(data.data.enabled),
            url: String(data.data.url || ""),
          });
        }
      })
      .catch(() => setSetting(null));
  }, []);

  if (!setting) return null;

  return (
    <section className="tile mt-8 max-w-3xl">
      <h2 className="text-lg">Footer Telegram link</h2>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={setting.enabled}
          disabled={saving}
          onChange={(event) => setSetting({ ...setting, enabled: event.target.checked })}
        />
        <span>Show Telegram in the footer Company links</span>
      </label>
      <label className="mt-4 block text-sm">
        Telegram URL
        <input
          className="field mt-1"
          type="url"
          placeholder="https://t.me/yourchannel"
          value={setting.url}
          disabled={saving}
          onChange={(event) => setSetting({ ...setting, url: event.target.value })}
        />
      </label>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
      <button
        type="button"
        className="gold-btn mt-4"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          setMessage("");
          setError("");
          void fetch("/api/admin/cms/footer-telegram", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              enabled: setting.enabled,
              url: setting.url.trim(),
            }),
          })
            .then(async (response) => {
              const data = (await response.json()) as {
                data?: Setting;
                message?: string;
                error?: string;
              };
              if (!response.ok) {
                setError(data.error || "Could not save.");
                return;
              }
              if (data.data) setSetting(data.data);
              setMessage(data.message || "Saved.");
            })
            .catch(() => setError("Could not save."))
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Saving…" : "Save Telegram setting"}
      </button>
    </section>
  );
}
