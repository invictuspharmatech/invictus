"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mediaUrl } from "@/lib/constants";
import {
  filterAndSortMedia,
  formatMediaUploadedAt,
  type MediaFolderFilter,
  type MediaLibraryItem,
  type MediaSort,
} from "@/lib/media-library";

type Props = {
  mode?: "manage" | "pick";
  value?: string;
  onPick?: (path: string) => void;
  /** Default folder for new uploads. */
  uploadFolder?: "products" | "site";
  /** When true (pick mode), first successful upload is assigned immediately. */
  autoSelectFirstUpload?: boolean;
  className?: string;
};

export function MediaLibraryBrowser({
  mode = "manage",
  value = "",
  onPick,
  uploadFolder = "products",
  autoSelectFirstUpload = mode === "pick",
  className = "",
}: Props) {
  const [items, setItems] = useState<MediaLibraryItem[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<MediaFolderFilter>("all");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [uploadTarget, setUploadTarget] = useState<"products" | "site">(uploadFolder);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterAndSortMedia(items ?? [], { query, folder, sort }),
    [items, query, folder, sort],
  );

  async function loadLibrary() {
    setError("");
    try {
      const res = await fetch("/api/admin/media/products");
      const data = (await res.json().catch(() => ({}))) as {
        items?: MediaLibraryItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load uploaded images.");
      }
      setItems(data.items ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not load uploaded images.");
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    setUploadTarget(uploadFolder);
  }, [uploadFolder]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("folder", uploadTarget);
      for (const file of Array.from(files)) {
        form.append("files", file, file.name);
      }
      const res = await fetch("/api/admin/media/products", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        saved?: MediaLibraryItem[];
        items?: MediaLibraryItem[];
        error?: string;
        errors?: { filename: string; error: string }[];
      };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      if (data.items) setItems(data.items);
      else await loadLibrary();
      const first = data.saved?.[0]?.path;
      if (first && autoSelectFirstUpload && onPick) onPick(first);
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

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(event) => void onUpload(event.target.files)}
        />
        {mode === "manage" ? (
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Upload to
            <select
              className="field min-w-[10rem]"
              value={uploadTarget}
              onChange={(event) =>
                setUploadTarget(event.target.value === "site" ? "site" : "products")
              }
            >
              <option value="products">Products</option>
              <option value="site">Site (home / CMS)</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="gold-btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload images"}
        </button>
        <label className="grid min-w-[12rem] flex-1 gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Search
          <input
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Filter by filename"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Folder
          <select
            className="field min-w-[9rem]"
            value={folder}
            onChange={(event) => setFolder(event.target.value as MediaFolderFilter)}
          >
            <option value="all">All</option>
            <option value="products">Products</option>
            <option value="site">Site</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Sort
          <select
            className="field min-w-[11rem]"
            value={sort}
            onChange={(event) => setSort(event.target.value as MediaSort)}
          >
            <option value="newest">Newest upload</option>
            <option value="oldest">Oldest upload</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {items == null
          ? "Loading…"
          : `${filtered.length} image${filtered.length === 1 ? "" : "s"} shown${
              items.length !== filtered.length ? ` (of ${items.length})` : ""
            }`}
        {mode === "pick" ? " · Click an image to assign it." : " · Bulk upload supported."}
      </p>

      {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}

      {items == null && !error ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading images…</p>
      ) : null}
      {items && filtered.length === 0 && !error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No images match. Upload files or clear filters.
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => {
            const selected = mode === "pick" && item.path === value;
            const src = mediaUrl(item.path) ?? item.path;
            const body = (
              <>
                <span className="block aspect-square overflow-hidden bg-muted">
                  <img src={src} alt="" className="size-full object-cover" />
                </span>
                <span className="mt-2 block truncate text-[11px] text-muted-foreground" title={item.name}>
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/80">
                  {item.folder || "products"} · {formatMediaUploadedAt(item.uploadedAt)}
                </span>
              </>
            );
            return (
              <li key={item.path}>
                {mode === "pick" && onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(item.path)}
                    className={`w-full border p-2 text-left hover:border-signal ${
                      selected ? "border-signal bg-signal/10" : "border-border/50"
                    }`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="w-full border border-border/50 p-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
