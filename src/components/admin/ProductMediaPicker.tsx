"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "@/lib/constants";

type ProductMediaItem = {
  path: string;
  name: string;
};

type Props = {
  value: string;
  onChange: (path: string) => void;
};

export function ProductMediaPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductMediaItem[] | null>(null);
  const [error, setError] = useState("");
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    fetch("/api/admin/media/products")
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          items?: ProductMediaItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Could not load uploaded images.");
        }
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setError("Could not load uploaded images.");
        }
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
              Uploaded product images
            </h2>
            <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            These files are already in the project at <code>/images/products</code>. Click one to
            assign it.
          </p>
          <input
            className="field mt-3"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Search by filename"
            autoFocus
          />
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          {items == null && !error ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading images…</p>
          ) : null}
          {items && filtered.length === 0 && !error ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No uploaded images found. Add files to <code>public/images/products</code>.
            </p>
          ) : null}
          {filtered.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((item) => {
                const selected = item.path === value;
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
                        <img src={item.path} alt="" className="size-full object-cover" />
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
      <span className="text-xs">Product image</span>
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
