"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiCategory } from "@/lib/api-types";
import { ProductMediaPicker } from "@/components/admin/ProductMediaPicker";

export function CategoryForm({ category }: { category?: ApiCategory }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [image, setImage] = useState(category?.image ?? "");

  return (
    <form
      className="mt-6 grid max-w-xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const payload = {
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          description: String(form.get("description") || ""),
          image: image.trim(),
          sortOrder: Number(form.get("sortOrder") || 0),
          skuAbbreviation: String(form.get("skuAbbreviation") || "")
            .trim()
            .toUpperCase(),
          isFeatured: form.get("isFeatured") === "on",
        };
        const res = await fetch(
          category ? `/api/admin/categories/${category.id}` : "/api/admin/categories",
          {
            method: category ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Could not save category.",
          );
          return;
        }
        router.push("/admin/categories");
        router.refresh();
      }}
    >
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <label className="grid gap-1 text-sm">
        Name
        <input className="field" name="name" defaultValue={category?.name} required />
      </label>
      <label className="grid gap-1 text-sm">
        Slug
        <input className="field" name="slug" defaultValue={category?.slug} />
      </label>
      <label className="grid gap-1 text-sm">
        Description
        <textarea className="field min-h-24" name="description" defaultValue={category?.description} />
      </label>
      <ProductMediaPicker
        label="Category image (home carousel)"
        value={image}
        onChange={setImage}
        uploadFolder="site"
      />
      <label className="grid gap-1 text-sm">
        Sort order
        <input
          className="field"
          name="sortOrder"
          type="number"
          defaultValue={category?.sortOrder ?? 0}
        />
        <span className="text-xs text-muted-foreground">
          Lower numbers appear first on the homepage carousel.
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isFeatured"
          type="checkbox"
          defaultChecked={Boolean(category?.isFeatured)}
        />
        Featured on homepage
      </label>
      <label className="grid gap-1 text-sm">
        SKU abbreviation
        <input
          className="field"
          name="skuAbbreviation"
          defaultValue={category?.skuAbbreviation ?? ""}
          placeholder="e.g. OILS, PEP, AMNO, ORAL, PCTM"
          maxLength={16}
        />
        <span className="text-xs text-muted-foreground">
          Products use <span className="font-mono">IP-{"{ABBR}"}-001</span>. Leave blank to
          skip auto SKUs for this category.
        </span>
      </label>
      <button className="gold-btn w-fit" type="submit">
        {category ? "Save category" : "Create category"}
      </button>
    </form>
  );
}
