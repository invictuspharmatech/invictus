"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import type { ApiCategory } from "@/lib/api-types";

type ImportResultRow = {
  action: string;
  id?: string;
  name?: string;
  sku?: string;
  image?: string;
  error?: string;
};

export function ProductImageImportBoard({ categories }: { categories: ApiCategory[] }) {
  const [categoryId, setCategoryId] = useState(() => {
    const peptides =
      categories.find((c) => c.slug === "peptides" || c.slug === "peptides-glps") ??
      categories[0];
    return peptides?.id ?? "";
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    created: number;
    updated: number;
    errors: number;
    categoryName: string;
    results: ImportResultRow[];
    uploadErrors?: { filename: string; error: string }[];
  } | null>(null);

  const preview = useMemo(
    () =>
      files.slice(0, 40).map((file) => ({
        name: file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim(),
        filename: file.name,
      })),
    [files],
  );

  function onFolderChange(event: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(event.target.files || []).filter((file) =>
      /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name),
    );
    setFiles(list);
    setSummary(null);
    setError("");
  }

  async function runImport() {
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    if (!files.length) {
      setError("Choose a folder with PNG/JPG images.");
      return;
    }
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const form = new FormData();
      form.set("categoryId", categoryId);
      for (const file of files) {
        form.append("files", file, file.name);
      }
      const res = await fetch("/api/admin/products/import-images", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
        updated?: number;
        errors?: number;
        categoryName?: string;
        results?: ImportResultRow[];
        uploadErrors?: { filename: string; error: string }[];
      };
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setSummary({
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        errors: data.errors ?? 0,
        categoryName: data.categoryName || "",
        results: data.results || [],
        uploadErrors: data.uploadErrors,
      });
      setFiles([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="tile max-w-2xl space-y-4">
        <h2 className="text-lg">Import products from image folder</h2>
        <p className="text-sm text-muted-foreground">
          Select a folder of product images. Each filename becomes the product name (e.g.{" "}
          <code>retatrutide 10mg.png</code> → Retatrutide 10mg). Matching is case-insensitive. If
          that name already exists, only the image is updated. Otherwise a <strong>draft</strong>{" "}
          product is created with an auto SKU. Images are stored in site media (
          <code>/media/products/</code>), so they work on live after deploy. Re-run this import to
          fix products that were created earlier without visible images.
        </p>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Category
          <select
            className="field normal-case tracking-normal"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.skuAbbreviation ? ` (${category.skuAbbreviation})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Image folder
          <input
            className="field normal-case tracking-normal file:mr-3"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={onFolderChange}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
        </label>

        {files.length ? (
          <p className="text-sm text-muted-foreground">
            {files.length} image{files.length === 1 ? "" : "s"} selected
            {preview.length < files.length ? ` (showing first ${preview.length} names)` : ""}.
          </p>
        ) : null}

        {preview.length > 0 ? (
          <ul className="max-h-48 overflow-y-auto border border-border/40 text-sm">
            {preview.map((row) => (
              <li
                key={row.filename}
                className="flex justify-between gap-2 border-b border-border/30 px-3 py-1.5 last:border-0"
              >
                <span>{row.name}</span>
                <span className="truncate text-xs text-muted-foreground">{row.filename}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}

        <button
          type="button"
          className="gold-btn"
          disabled={busy || !files.length || !categoryId}
          onClick={() => void runImport()}
        >
          {busy ? "Importing…" : "Import images"}
        </button>
      </div>

      {summary ? (
        <div className="tile space-y-3">
          <h2 className="text-lg">Import result · {summary.categoryName}</h2>
          <p className="text-sm text-muted-foreground">
            Created {summary.created} · Updated images {summary.updated} · Errors {summary.errors}
          </p>
          {summary.uploadErrors?.length ? (
            <ul className="text-sm text-brand-red">
              {summary.uploadErrors.map((row) => (
                <li key={row.filename}>
                  {row.filename}: {row.error}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="py-2">Action</th>
                  <th>Name</th>
                  <th>SKU</th>
                </tr>
              </thead>
              <tbody>
                {summary.results.map((row, index) => (
                  <tr key={`${row.id || row.name || index}`} className="border-t border-border/40">
                    <td className="py-2 capitalize">{row.action}</td>
                    <td>{row.name || "—"}</td>
                    <td className="font-mono text-xs">{row.sku || row.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
