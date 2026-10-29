"use client";

import Link from "next/link";
import { useState } from "react";
import type { ApiCategory } from "@/lib/api-types";

export function AdminCategoriesTable({ categories }: { categories: ApiCategory[] }) {
  const [rows, setRows] = useState(categories);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleFeatured(category: ApiCategory) {
    setBusyId(category.id);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          image: category.image ?? "",
          sortOrder: category.sortOrder ?? 0,
          skuAbbreviation: category.skuAbbreviation ?? "",
          isFeatured: !category.isFeatured,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiCategory & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not update category.");
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === category.id ? { ...row, isFeatured: Boolean(data.isFeatured) } : row,
        ),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update category.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="tile mt-6 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="py-2">Name</th>
            <th>Slug</th>
            <th>SKU abbr</th>
            <th>Sort</th>
            <th title="Featured on homepage">Home ★</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((category) => (
            <tr key={category.id} className="border-t border-border/40">
              <td className="py-3">{category.name}</td>
              <td>{category.slug}</td>
              <td className="font-mono text-xs">{category.skuAbbreviation || "—"}</td>
              <td>{category.sortOrder}</td>
              <td>
                <button
                  type="button"
                  title={
                    category.isFeatured
                      ? "Remove from homepage"
                      : "Show on homepage"
                  }
                  disabled={busyId === category.id}
                  onClick={() => void toggleFeatured(category)}
                  className="text-lg leading-none disabled:opacity-50"
                >
                  {category.isFeatured ? (
                    <span className="text-signal">★</span>
                  ) : (
                    <span className="text-muted-foreground/50 hover:text-signal">☆</span>
                  )}
                </button>
              </td>
              <td>
                <Link href={`/admin/categories/${category.id}`} className="text-sm text-signal">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
