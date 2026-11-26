"use client";

import { useEffect, useState } from "react";

type Setting = {
  enabled: boolean;
  credentials_ready: boolean;
};

export function SiteWideIpBlockCard() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/settings/cloudflare-ip-block")
      .then(async (response) => {
        const data = (await response.json()) as { data?: Setting };
        if (response.ok && data.data) setSetting(data.data);
      })
      .catch(() => setSetting(null));
  }, []);

  if (!setting) return null;

  return (
    <section className="tile mt-6 max-w-3xl">
      <h2 className="text-lg">Site-wide IP block</h2>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={setting.enabled}
          disabled={saving}
          onChange={(event) => setSetting({ ...setting, enabled: event.target.checked })}
        />
        Enable site-wide IP block
      </label>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
      <button
        type="button"
        className="gold-btn mt-3"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          setMessage("");
          void fetch("/api/admin/settings/cloudflare-ip-block", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: setting.enabled }),
          })
            .then(async (response) => {
              const data = (await response.json()) as { data?: Setting; message?: string; error?: string };
              if (!response.ok) {
                setMessage(data.error || "Could not save this setting.");
                return;
              }
              if (data.data) setSetting(data.data);
              setMessage(data.message || "Saved.");
            })
            .catch(() => setMessage("Could not save this setting."))
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </section>
  );
}
