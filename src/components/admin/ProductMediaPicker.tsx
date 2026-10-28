"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "@/lib/constants";

type ProductMediaItem = {
  path: string;
  name: string;
};

type Props = {
  value: string;
  onChange: (path: string) => void;
  label?: string;
  /** Django MEDIA folder for new uploads (products | site). */
  uploadFolder?: "products" | "site";
};

export function ProductMediaPicker({
  value,
  onChange,
  label = "Product image",
  uploadFolder = "products",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductMediaItem[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preview = mediaUrl(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !items) return items ?? [];
    return items.filter(
      (item) => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  async function loadLibrary() {
    setError("");
    try {
      const res = await fetch("/api/admin/media/products");
      const data = (await res.json().catch(() => ({}))) as {
        items?: ProductMediaItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load uploaded images.");
      }
      setItems(data.items ?? []);
    } catch {
      setItems([]);
      setError("Could not load uploaded images.");
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    void loadLibrary().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function choose(path: string) {
    onChange(path);
    setOpen(false);
    setQuery("");
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("folder", uploadFolder);
      for (const file of Array.from(files)) {
        form.append("files", file, file.name);
      }
      const res = await fetch("/api/admin/media/products", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        saved?: ProductMediaItem[];
        items?: ProductMediaItem[];
        error?: string;
        errors?: { filename: string; error: string }[];
      };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      if (data.items) setItems(data.items);
      else await loadLibrary();
      const first = data.saved?.[0]?.path;
      if (first) onChange(first);
      if (data.errors?.length) {
        setError(data.errors.map((row) => `${row.filename}: ${row.error}`).join(" · "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const dialog =
    open && typeof document !== "undefined" ? (
      <div
        className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/80 p-4 pt-16"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-media-title"
        onClick={() => setOpen(false)}
      >
        <div
          className="w-full max-w-4xl border border-border/60 bg-card p-4 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="product-media-title" className="display-font text-xl">
              Image library
            </h2>
            <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Uploads are stored in Django media (<code>/media/</code>) so they persist on live.
            Click an image to assign it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              className="hidden"
              onChange={(event) => void onUpload(event.target.files)}
            />
            <button
              type="button"
              className="gold-btn"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload images"}
            </button>
            <input
              className="field min-w-[12rem] flex-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Search by filename"
              autoFocus
            />
          </div>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          {items == null && !error ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading images…</p>
          ) : null}
          {items && filtered.length === 0 && !error ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No images yet. Upload files to get started.
            </p>
          ) : null}
          {filtered.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((item) => {
                const selected = item.path === value;
                const src = mediaUrl(item.path) ?? item.path;
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => choose(item.path)}
                      className={`w-full border p-2 text-left hover:border-signal ${
                        selected ? "border-signal bg-signal/10" : "border-border/50"
                      }`}
                    >
                      <span className="block aspect-square overflow-hidden bg-muted">
                        <img src={src} alt="" className="size-full object-cover" />
                      </span>
                      <span className="mt-2 block truncate text-[11px] text-muted-foreground">
                        {item.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-xs">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-16 place-items-center overflow-hidden border border-border/50 bg-muted">
          {preview ? (
            <img src={preview} alt="" className="size-16 object-cover" />
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">None</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-xs text-muted-foreground" title={value || undefined}>
            {value || "No image assigned"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="gold-btn" onClick={() => setOpen(true)}>
              Choose from library
            </button>
            {value ? (
              <button type="button" className="ghost-btn" onClick={() => onChange("")}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {dialog ? createPortal(dialog, document.body) : null}
    </div>
  );
}
