"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ComingSoonAdmin } from "@/lib/coming-soon";

type Subscriber = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  launchNotifyAt: string | null;
  createdAt: string | null;
};

export function ComingSoonSettings() {
  const [form, setForm] = useState({
    enabled: false,
    launchAtLocal: "2026-11-16T00:00",
    bannerText: "",
    eyebrow: "",
    dek: "",
    panelLabel: "",
    panelHeading: "",
    panelSub: "",
  });
  const [preview, setPreview] = useState<ComingSoonAdmin | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [settingsRes, listRes] = await Promise.all([
      fetch("/api/admin/cms/coming-soon"),
      fetch("/api/admin/cms/coming-soon/subscribers"),
    ]);
    const settings = (await settingsRes.json().catch(() => null)) as ComingSoonAdmin & {
      error?: string;
    } | null;
    const list = (await listRes.json().catch(() => null)) as {
      count?: number;
      items?: Subscriber[];
      error?: string;
    } | null;
    setLoading(false);
    if (!settingsRes.ok || !settings || settings.error) {
      setError(settings?.error || "Could not load coming-soon settings.");
      return;
    }
    setPreview(settings);
    setForm({
      enabled: settings.enabled === true,
      launchAtLocal: settings.launchAtLocal || "2026-11-16T00:00",
      bannerText: settings.bannerText || "",
      eyebrow: settings.eyebrow || "",
      dek: settings.dek || "",
      panelLabel: settings.panelLabel || "",
      panelHeading: settings.panelHeading || "",
      panelSub: settings.panelSub || "",
    });
    if (listRes.ok && list) {
      setCount(list.count || 0);
      setSubscribers(Array.isArray(list.items) ? list.items : []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/cms/coming-soon", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => null)) as ComingSoonAdmin & { error?: string } | null;
    setSaving(false);
    if (!res.ok || !data || data.error) {
      setError(data?.error || "Could not save.");
      return;
    }
    setPreview(data);
    setMessage(data.enabled ? "Coming-soon landing is active on /." : "Coming-soon disabled — original homepage is live.");
    await load();
  }

  if (loading) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mt-6 space-y-8">
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <form onSubmit={onSave} className="tile max-w-3xl space-y-4 p-4">
        <label className="flex items-start gap-3 rounded border border-border/50 bg-muted/20 p-3 text-sm">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
          />
          <span>
            <strong>Enable coming-soon landing on homepage</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              When on, `/` shows the launch page. The original homepage stays in the codebase and
              returns when this is off. Catalog and other routes keep working.
            </span>
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          Launch date & time (Eastern / EST–EDT)
          <input
            className="field"
            type="datetime-local"
            value={form.launchAtLocal}
            onChange={(event) => setForm((prev) => ({ ...prev, launchAtLocal: event.target.value }))}
            required
          />
          <span className="text-xs text-muted-foreground">
            Countdown and launch copy use this Eastern wall-clock time.
            {preview?.launchDisplay ? ` Preview: ${preview.launchDisplay}` : ""}
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          Top banner text
          <input
            className="field"
            value={form.bannerText}
            onChange={(event) => setForm((prev) => ({ ...prev, bannerText: event.target.value }))}
            placeholder="A stronger standard arrives November 16"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Eyebrow
          <input
            className="field"
            value={form.eyebrow}
            onChange={(event) => setForm((prev) => ({ ...prev, eyebrow: event.target.value }))}
          />
        </label>

        <label className="grid gap-1 text-sm">
          Main description (HTML allowed for &lt;strong&gt;)
          <textarea
            className="field min-h-28"
            value={form.dek}
            onChange={(event) => setForm((prev) => ({ ...prev, dek: event.target.value }))}
          />
        </label>

        <label className="grid gap-1 text-sm">
          Panel label
          <input
            className="field"
            value={form.panelLabel}
            onChange={(event) => setForm((prev) => ({ ...prev, panelLabel: event.target.value }))}
          />
        </label>

        <label className="grid gap-1 text-sm">
          Panel heading (HTML)
          <textarea
            className="field min-h-20"
            value={form.panelHeading}
            onChange={(event) => setForm((prev) => ({ ...prev, panelHeading: event.target.value }))}
          />
        </label>

        <label className="grid gap-1 text-sm">
          Panel subcopy (HTML)
          <textarea
            className="field min-h-20"
            value={form.panelSub}
            onChange={(event) => setForm((prev) => ({ ...prev, panelSub: event.target.value }))}
          />
        </label>

        <button className="gold-btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save coming-soon settings"}
        </button>
      </form>

      <section className="tile max-w-4xl space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg">Launch notify list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Users who created an account / signed in and opted in for the launch email.{" "}
              {count} total.
            </p>
          </div>
          <a className="ghost-btn" href="/admin/email">
            Open bulk email
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          In Bulk Email, check <strong>Launch notify subscribers</strong>, preview, then send when
          you go live.
        </p>
        {subscribers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscribers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Active</th>
                  <th className="px-2 py-2">Opted in</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((row) => (
                  <tr key={row.id} className="border-t border-border/40">
                    <td className="px-2 py-2">{row.name}</td>
                    <td className="px-2 py-2">{row.email}</td>
                    <td className="px-2 py-2">{row.isActive ? "Yes" : "No"}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {row.launchNotifyAt
                        ? new Date(row.launchNotifyAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
