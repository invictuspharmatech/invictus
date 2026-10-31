"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "@/lib/constants";
import { MediaLibraryBrowser } from "@/components/admin/MediaLibraryBrowser";

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
  const preview = mediaUrl(value);

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

  function choose(path: string) {
    onChange(path);
    setOpen(false);
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
          className="w-full max-w-5xl border border-border/60 bg-card p-4 shadow-2xl"
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
            Search by name, sort by upload date, or filter by folder. Uploads persist under{" "}
            <code>/media/</code>.
          </p>
          <div className="mt-4">
            <MediaLibraryBrowser
              mode="pick"
              value={value}
              onPick={choose}
              uploadFolder={uploadFolder}
              autoSelectFirstUpload
            />
          </div>
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
