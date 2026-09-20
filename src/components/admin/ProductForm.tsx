"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

export function ProductForm({
  product,
  categories,
}: {
  product?: ApiProduct;
  categories: ApiCategory[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const selected = new Set(product?.categoryIds ?? []);

  return (
    <form
      className="mt-6 grid max-w-3xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const categoryIds = form.getAll("categoryIds").map(String);
        const payload = {
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          sku: String(form.get("sku") || ""),
          shortDescription: String(form.get("shortDescription") || ""),
          description: String(form.get("description") || ""),
          image: String(form.get("image") || ""),
          regularPrice: Number(form.get("regularPrice") || 0),
          salePrice: form.get("salePrice") ? Number(form.get("salePrice")) : null,
          warehouse: String(form.get("warehouse") || "WAREHOUSE_2"),
          stockQuantityW1: Number(form.get("stockQuantityW1") || 0),
          stockQuantityW2: Number(form.get("stockQuantityW2") || 0),
          status: String(form.get("status") || "publish"),
          isFeatured: form.get("isFeatured") === "on",
          isNewArrival: form.get("isNewArrival") === "on",
          allowBackorder: form.get("allowBackorder") === "on",
          categoryIds,
        };
        const res = await fetch(
          product ? `/api/admin/products/${product.id}` : "/api/admin/products",
          {
            method: product ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not save product.");
          return;
        }
        router.push("/admin/products");
        router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        Name
        <input className="field" name="name" defaultValue={product?.name} required />
      </label>
      <label className="grid gap-1 text-sm">
        Slug
        <input className="field" name="slug" defaultValue={product?.slug} />
      </label>
      <label className="grid gap-1 text-sm">
        SKU
        <input className="field" name="sku" defaultValue={product?.sku} />
      </label>
      <label className="grid gap-1 text-sm">
        Short description
        <textarea className="field min-h-20" name="shortDescription" defaultValue={product?.shortDescription} />
      </label>
      <label className="grid gap-1 text-sm">
        Description
        <textarea className="field min-h-40" name="description" defaultValue={product?.description} />
      </label>
      <label className="grid gap-1 text-sm">
        Image URL
        <input className="field" name="image" defaultValue={product?.image ?? ""} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Regular price
          <input
            className="field"
            name="regularPrice"
            type="number"
            step="0.01"
            defaultValue={product?.regularPrice ?? 0}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Sale price
          <input
            className="field"
            name="salePrice"
            type="number"
            step="0.01"
            defaultValue={product?.salePrice ?? ""}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Home warehouse
        <select className="field" name="warehouse" defaultValue={product?.warehouse ?? "WAREHOUSE_2"}>
          <option value="WAREHOUSE_1">Warehouse 1</option>
          <option value="WAREHOUSE_2">Warehouse 2</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          W1 stock
          <input
            className="field"
            name="stockQuantityW1"
            type="number"
            defaultValue={product?.stockQuantityW1 ?? 0}
          />
        </label>
        <label className="grid gap-1 text-sm">
          W2 stock
          <input
            className="field"
            name="stockQuantityW2"
            type="number"
            defaultValue={product?.stockQuantityW2 ?? 0}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Total
          <input
            className="field"
            readOnly
            value={(product?.stockQuantityW1 ?? 0) + (product?.stockQuantityW2 ?? 0)}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Status
        <input className="field" name="status" defaultValue={product?.status ?? "publish"} />
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend>Categories</legend>
        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              name="categoryIds"
              value={category.id}
              defaultChecked={selected.has(category.id)}
            />
            {category.name}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input name="allowBackorder" type="checkbox" defaultChecked={product?.allowBackorder ?? true} />
        Allow backorder — if off, W1 + W2 total blocks selling more than you have
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isFeatured" type="checkbox" defaultChecked={product?.isFeatured} />
        Featured
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isNewArrival" type="checkbox" defaultChecked={product?.isNewArrival} />
        New arrival
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button className="gold-btn max-w-40" type="submit">
        Save product
      </button>
    </form>
  );
}
