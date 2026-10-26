"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ApiCategory } from "@/lib/api-types";

type Assignment = {
  productId: string;
  name: string;
  oldSku: string;
  newSku: string;
  reason?: string;
};

type GenerateResult = {
  ok?: boolean;
  error?: string;
  abbreviation?: string;
  categoryName?: string;
  dryRun?: boolean;
  updated?: number;
  wouldUpdate?: number;
  skipped?: number;
  assignments?: Assignment[];
  skippedRows?: Assignment[];
};

export function SkuGenerateBoard({ categories }: { categories: ApiCategory[] }) {
  const withAbbr = useMemo(
    () => categories.filter((row) => (row.skuAbbreviation || "").trim()),
    [categories],
  );
  const [categoryId, setCategoryId] = useState(withAbbr[0]?.id ?? "");
  const [rewriteExisting, setRewriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<GenerateResult | null>(null);

  const selected = categories.find((row) => row.id === categoryId) ?? null;

  async function run(dryRun: boolean) {
    if (!categoryId) {
      setError("Choose a category with a SKU abbreviation.");
      return;
    }
    if (
      !dryRun &&
      rewriteExisting &&
      !window.confirm(
        "Rewrite existing SKUs for products in this category? This cannot be undone easily.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/products/generate-skus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId, rewriteExisting, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as GenerateResult;
      if (!res.ok) {
        setError(data.error || "Could not generate SKUs.");
        setPreview(null);
        return;
      }
      setPreview(data);
    } catch {
      setError("Could not generate SKUs.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="tile max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Format: <span className="font-mono">IP-{"{ABBR}"}-001</span>. Set abbreviations on{" "}
          <Link href="/admin/categories" className="text-signal underline">
            Categories
          </Link>{" "}
          first (Oils → OILS, Peptides → PEP, Aminos → AMNO, Orals → ORAL, PCT → PCTM).
        </p>
        <label className="grid max-w-md gap-1 text-sm">
          Category
          <select
            className="field"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPreview(null);
              setError("");
            }}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id} disabled={!category.skuAbbreviation}>
                {category.name}
                {category.skuAbbreviation ? ` (${category.skuAbbreviation})` : " — no abbr"}
              </option>
            ))}
          </select>
        </label>
        {selected?.skuAbbreviation ? (
          <p className="text-sm">
            Abbreviation: <span className="font-mono">{selected.skuAbbreviation}</span>
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rewriteExisting}
            onChange={(event) => {
              setRewriteExisting(event.target.checked);
              setPreview(null);
            }}
          />
          Rewrite existing SKUs (off = skip products that already have a SKU)
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ghost-btn"
            disabled={busy || !categoryId}
            onClick={() => void run(true)}
          >
            {busy ? "Working…" : "Preview"}
          </button>
          <button
            type="button"
            className="gold-btn"
            disabled={busy || !categoryId}
            onClick={() => void run(false)}
          >
            Apply SKUs
          </button>
        </div>
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      </div>

      {preview ? (
        <div className="tile space-y-3">
          <h2 className="text-lg">
            {preview.dryRun ? "Preview" : "Applied"} · {preview.categoryName} ·{" "}
            <span className="font-mono">{preview.abbreviation}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {preview.dryRun
              ? `Would update ${preview.wouldUpdate ?? 0}, skip ${preview.skipped ?? 0}.`
              : `Updated ${preview.updated ?? 0}, skipped ${preview.skipped ?? 0}.`}
          </p>
          {(preview.assignments?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="py-2">Product</th>
                    <th>Old SKU</th>
                    <th>New SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.assignments?.map((row) => (
                    <tr key={row.productId} className="border-t border-border/40">
                      <td className="py-2">{row.name}</td>
                      <td className="font-mono text-xs">{row.oldSku || "—"}</td>
                      <td className="font-mono text-xs">{row.newSku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products to update.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
