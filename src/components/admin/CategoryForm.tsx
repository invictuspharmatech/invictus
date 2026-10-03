"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiCategory } from "@/lib/api-types";

export function CategoryForm({ category }: { category?: ApiCategory }) {
  const router = useRouter();
  const [error, setError] = useState("");

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
          image: String(form.get("image") || ""),
          sortOrder: Number(form.get("sortOrder") || 0),
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
      <label className="grid gap-1 text-sm">
        Image path
        <input className="field" name="image" defaultValue={category?.image ?? ""} />
      </label>
      <label className="grid gap-1 text-sm">
        Sort order
        <input
          className="field"
          name="sortOrder"
          type="number"
          defaultValue={category?.sortOrder ?? 0}
        />
      </label>
      <button className="gold-btn w-fit" type="submit">
        {category ? "Save category" : "Create category"}
      </button>
    </form>
  );
}
