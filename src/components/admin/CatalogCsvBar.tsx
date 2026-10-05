"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ImportCsvModal({
  kind,
  onClose,
  onSuccess,
}: {
  kind: "products" | "categories";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported?: number; skipped?: number; errors?: string[] } | null>(
    null,
  );

  async function runImport() {
    if (!file) {
      setError("Choose a CSV file.");
      return;
    }
    setBusy(true);
    setError("");
    const csvData = await file.text();
    const path = kind === "products" ? "/api/admin/products/import" : "/api/admin/categories/import";
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csvData }),
    });
    const payload = (await response.json()) as {
      imported?: number;
      skipped?: number;
      errors?: string[];
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Import failed.");
      return;
    }
    setResult(payload);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="tile max-w-lg w-full">
        <h2 className="text-lg">Import {kind} CSV</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {kind === "products"
            ? "Accepts WooCommerce-style columns (post_title, sku, regular_price, stock) or an Invictus export."
            : "Requires a name column. Description and sort order are optional."}
        </p>
        <input
          className="mt-4 block"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
        {result ? (
          <p className="mt-3 text-sm">
            Imported {result.imported ?? 0}, skipped {result.skipped ?? 0}.
          </p>
        ) : null}
        {result?.errors?.length ? (
          <ul className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
            {result.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="gold-btn" disabled={busy} onClick={() => void runImport()}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CatalogCsvBar({
  kind,
  openImport = false,
  autoExport = false,
}: {
  kind: "products" | "categories";
  openImport?: boolean;
  autoExport?: boolean;
}) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(openImport);

  useEffect(() => {
    if (!autoExport) return;
    const path = kind === "products" ? "/api/admin/products/export" : "/api/admin/categories/export";
    window.location.assign(path);
    router.replace(kind === "products" ? "/admin/products" : "/admin/categories");
  }, [autoExport, kind, router]);

  return (
    <>
      <div className="flex gap-2">
        <button type="button" className="ghost-btn" onClick={() => setShowImport(true)}>
          Import CSV
        </button>
        <a
          className="ghost-btn"
          href={kind === "products" ? "/api/admin/products/export" : "/api/admin/categories/export"}
        >
          Export CSV
        </a>
      </div>
      {showImport ? (
        <ImportCsvModal
          kind={kind}
          onClose={() => setShowImport(false)}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
