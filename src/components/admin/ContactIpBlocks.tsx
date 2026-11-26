"use client";

import { useEffect, useState } from "react";

type BlockRow = {
  id: number;
  ip_address: string;
  rejected_count: number;
  blocked_at: string | null;
  blocked_until?: string | null;
  permanent?: boolean;
  block_minutes?: number | null;
};

type BanSettings = {
  autoExpire: boolean;
  minutes: number;
};

export function ContactIpBlocks() {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [settings, setSettings] = useState<BanSettings>({ autoExpire: true, minutes: 30 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    void fetch("/api/admin/contact/ip-blocks")
      .then(async (response) => {
        const data = (await response.json()) as {
          data?: BlockRow[];
          settings?: BanSettings;
        };
        setRows(Array.isArray(data.data) ? data.data : []);
        if (data.settings) {
          setSettings({
            autoExpire: Boolean(data.settings.autoExpire),
            minutes: Number(data.settings.minutes) || 30,
          });
        }
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setNotice("");
    setError("");
    const response = await fetch("/api/admin/contact/ban-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        autoExpire: settings.autoExpire,
        minutes: settings.minutes,
      }),
    });
    const data = (await response.json().catch(() => null)) as
      | { message?: string; error?: string; data?: BanSettings }
      | null;
    setSaving(false);
    if (!response.ok) {
      setError(data?.error || "Could not save ban settings.");
      return;
    }
    if (data?.data) setSettings(data.data);
    setNotice(data?.message || "Ban settings saved.");
  }

  return (
    <section className="tile space-y-4">
      <div>
        <h2 className="text-lg">Blocked contact IPs</h2>
      </div>

      <div className="border border-border/40 p-3">
        <h3 className="text-sm font-medium">Ban duration</h3>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.autoExpire}
            onChange={(event) =>
              setSettings((current) => ({ ...current, autoExpire: event.target.checked }))
            }
          />
          Auto-remove ban after a set time
        </label>
        {settings.autoExpire ? (
          <label className="mt-3 block text-sm">
            Minutes until auto-remove
            <input
              className="field mt-1 max-w-[8rem]"
              type="number"
              min={1}
              max={43200}
              value={settings.minutes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  minutes: Math.max(1, Number(event.target.value) || 1),
                }))
              }
            />
          </label>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="gold-btn" disabled={saving} onClick={() => void saveSettings()}>
            {saving ? "Saving…" : "Save ban settings"}
          </button>
          {notice ? <span className="text-sm text-muted-foreground">{notice}</span> : null}
          {error ? <span className="text-sm text-brand-red">{error}</span> : null}
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading blocks…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No IPs are blocked from the contact form.</p>
      ) : null}
      <ul className="divide-y divide-border/40">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">{row.ip_address}</p>
              <p className="text-xs text-muted-foreground">
                {row.rejected_count} rejected
                {row.blocked_at ? ` · blocked ${new Date(row.blocked_at).toLocaleString()}` : ""}
                {row.permanent || !row.blocked_until
                  ? " · permanent until removed"
                  : ` · until ${new Date(row.blocked_until).toLocaleString()}`}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === row.id}
              className="ghost-btn"
              onClick={() => {
                if (!window.confirm(`Remove the contact form block for ${row.ip_address}?`)) return;
                setBusyId(row.id);
                void fetch(`/api/admin/contact/ip-blocks/${row.id}`, { method: "DELETE" })
                  .then((response) => {
                    if (response.ok) setRows((current) => current.filter((item) => item.id !== row.id));
                  })
                  .finally(() => setBusyId(null));
              }}
            >
              {busyId === row.id ? "Removing…" : "Remove block"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
