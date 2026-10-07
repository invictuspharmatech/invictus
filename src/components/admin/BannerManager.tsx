"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BANNER_BG_OPTIONS,
  BANNER_TEXT_OPTIONS,
  bannerBgColor,
  bannerTextColor,
} from "@/lib/feature-banners";
import type { ApiBanner, ApiBannerRuntime, BannerBgMode, BannerTextMode } from "@/lib/api-types";

const emptyForm = {
  title: "",
  href: "",
  sortOrder: 0,
  bgColorMode: "brand-orange" as BannerBgMode,
  textColorMode: "light" as BannerTextMode,
  isActive: true,
};

export function BannerManager({ initial }: { initial: ApiBannerRuntime }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trashed = searchParams.get("trashed") === "1";
  const [items, setItems] = useState(initial.items);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [displayMode, setDisplayMode] = useState(initial.displayMode);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiBanner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.title.toLowerCase().includes(q));
  }, [items, search]);

  useEffect(() => {
    setItems(initial.items);
    setEnabled(initial.enabled);
    setDisplayMode(initial.displayMode);
  }, [initial]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(item: ApiBanner) {
    setEditing(item);
    setForm({
      title: item.title,
      href: item.href,
      sortOrder: item.sortOrder,
      bgColorMode: item.bgColorMode || "brand-orange",
      textColorMode: item.textColorMode || "light",
      isActive: item.isActive,
    });
    setError("");
    setShowForm(true);
  }

  async function refresh() {
    const params = new URLSearchParams();
    if (trashed) params.set("trashed", "1");
    const res = await fetch(`/api/admin/cms/banners/?${params.toString()}`);
    const data = (await res.json().catch(() => null)) as ApiBannerRuntime | ApiBanner[] | null;
    if (Array.isArray(data)) {
      setItems(data);
      return;
    }
    setItems(data?.items ?? []);
    if (typeof data?.enabled === "boolean") setEnabled(data.enabled);
    if (data?.displayMode === "marquee" || data?.displayMode === "slider") {
      setDisplayMode(data.displayMode);
    }
    router.refresh();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Please enter banner text.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      href: form.href.trim(),
      sortOrder: form.sortOrder,
      bgColorMode: form.bgColorMode,
      textColorMode: form.textColorMode,
      isActive: form.isActive,
      subtitle: "",
      ctaLabel: "",
    };
    const res = await fetch(
      editing ? `/api/admin/cms/banners/${editing.id}` : "/api/admin/cms/banners/",
      {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Could not save banner.",
      );
      return;
    }
    setShowForm(false);
    setEditing(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Move this banner to the recycle bin?")) return;
    await fetch(`/api/admin/cms/banners/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function handleRestore(id: string) {
    await fetch(`/api/admin/cms/banners/${id}/restore/`, { method: "POST" });
    await refresh();
  }

  async function toggleEnabled() {
    const next = !enabled;
    const res = await fetch("/api/admin/cms/banners/visibility/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    const data = (await res.json().catch(() => null)) as ApiBannerRuntime | null;
    if (typeof data?.enabled === "boolean") setEnabled(data.enabled);
  }

  async function setMode(next: "marquee" | "slider") {
    if (next === displayMode) return;
    const res = await fetch("/api/admin/cms/banners/display-mode/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayMode: next }),
    });
    const data = (await res.json().catch(() => null)) as ApiBannerRuntime | null;
    if (data?.displayMode === "marquee" || data?.displayMode === "slider") {
      setDisplayMode(data.displayMode);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-font text-3xl">
            {trashed ? "Banners — Deleted items" : "Banners"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {trashed ? (
            <Link href="/admin/cms/banners" className="ghost-btn">
              Back to list
            </Link>
          ) : (
            <>
              <input
                className="field max-w-xs"
                placeholder="Search by title..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="gold-btn" type="button" onClick={openAdd}>
                Add Banner
              </button>
              <button className="ghost-btn" type="button" onClick={toggleEnabled}>
                {enabled ? "Disable on storefront" : "Enable on storefront"}
              </button>
              <Link href="/admin/cms/banners?trashed=1" className="ghost-btn">
                Deleted items
              </Link>
            </>
          )}
          <Link href="/" target="_blank" className="ghost-btn">
            View on site
          </Link>
        </div>
      </div>

      {!trashed ? (
        <div className="tile mt-6">
          <h2 className="text-lg">Storefront display style</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how banner messages appear on the site header strip.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded border px-4 py-3 ${
                displayMode === "marquee" ? "border-signal" : "border-border/60"
              }`}
            >
              <input
                type="radio"
                className="mr-2"
                checked={displayMode === "marquee"}
                onChange={() => setMode("marquee")}
              />
              <span className="font-medium">Rolling ticker</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                All messages scroll continuously from right to left.
              </span>
            </label>
            <label
              className={`cursor-pointer rounded border px-4 py-3 ${
                displayMode === "slider" ? "border-signal" : "border-border/60"
              }`}
            >
              <input
                type="radio"
                className="mr-2"
                checked={displayMode === "slider"}
                onChange={() => setMode("slider")}
              />
              <span className="font-medium">Single-message slider</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Shows one banner at a time and rotates every few seconds.
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="tile max-h-[90vh] w-full max-w-md overflow-y-auto" onSubmit={handleSubmit}>
            <h2 className="text-xl">{editing ? "Edit Feature Banner" : "Add Feature Banner"}</h2>
            <label className="mt-4 grid gap-1 text-sm">
              Banner text
              <input
                className="field"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Summer Sale — 15% Off"
              />
            </label>
            <label className="mt-3 grid gap-1 text-sm">
              Link URL (optional)
              <input
                className="field"
                value={form.href}
                onChange={(event) => setForm({ ...form, href: event.target.value })}
                placeholder="/products"
              />
            </label>
            <label className="mt-3 grid gap-1 text-sm">
              Sort order
              <input
                className="field"
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })}
              />
            </label>
            <label className="mt-3 grid gap-1 text-sm">
              Background color
              <select
                className="field"
                value={form.bgColorMode}
                onChange={(event) =>
                  setForm({ ...form, bgColorMode: event.target.value as BannerBgMode })
                }
              >
                {BANNER_BG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm">
              Text color
              <select
                className="field"
                value={form.textColorMode}
                onChange={(event) =>
                  setForm({ ...form, textColorMode: event.target.value as BannerTextMode })
                }
              >
                {BANNER_TEXT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Active
            </label>
            <div
              className="mt-4 rounded px-4 py-3 text-center font-semibold"
              style={{
                backgroundColor: bannerBgColor(form.bgColorMode),
                color: bannerTextColor(form.textColorMode),
              }}
            >
              {form.title.trim() || "Banner preview text"}
            </div>
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className="ghost-btn" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="gold-btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="tile py-10 text-center text-sm text-muted-foreground">
            {trashed
              ? "No deleted banners."
              : "No banners yet. Add one to show in the strip under the navbar."}
          </div>
        ) : (
          <>
            {!trashed && !enabled ? (
              <p className="mb-3 rounded border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm">
                Storefront display is currently disabled. Banners remain saved.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <div key={item.id} className="tile flex flex-col overflow-hidden p-0">
                  <div
                    className="flex min-h-28 items-center justify-center px-4 py-6 text-center text-lg font-semibold"
                    style={{
                      backgroundColor: bannerBgColor(item.bgColorMode),
                      color: bannerTextColor(item.textColorMode),
                    }}
                  >
                    {item.title || "—"}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-medium">{item.title || "—"}</p>
                    {item.href ? (
                      <p className="truncate text-sm text-muted-foreground">Link: {item.href}</p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">Order: {item.sortOrder}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.isActive ? "Active" : "Inactive"} · {item.bgColorMode || "brand-orange"} ·{" "}
                      {item.textColorMode || "light"}
                    </p>
                    <div className="mt-3 flex gap-3 text-sm">
                      {trashed ? (
                        <button className="text-signal" type="button" onClick={() => handleRestore(item.id)}>
                          Restore
                        </button>
                      ) : (
                        <>
                          <button className="text-signal" type="button" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button
                            className="text-red-400"
                            type="button"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
