"use client";

import { useRouter } from "next/navigation";
import type { ApiTestResult } from "@/lib/api-types";

export function TestResultManager({ items }: { items: ApiTestResult[] }) {
  const router = useRouter();

  async function save(id: string | null, form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      productName: String(data.get("productName") || ""),
      category: String(data.get("category") || ""),
      imagePath: String(data.get("imagePath") || ""),
      sortOrder: Number(data.get("sortOrder") || 0),
    };
    await fetch(id ? `/api/admin/test-results/${id}` : "/api/admin/test-results", {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    form.reset();
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <form
        className="tile grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await save(null, event.currentTarget);
        }}
      >
        <h2 className="text-lg">Add test result</h2>
        <input className="field" name="productName" placeholder="Product name" required />
        <input className="field" name="category" placeholder="Category" />
        <input className="field" name="imagePath" placeholder="Image path or URL" required />
        <button className="gold-btn max-w-40" type="submit">
          Add
        </button>
      </form>
      {items.map((item) => (
        <form
          key={item.id}
          className="tile grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await save(item.id, event.currentTarget);
          }}
        >
          <input className="field" name="productName" defaultValue={item.productName} />
          <input className="field" name="category" defaultValue={item.category} />
          <input className="field" name="imagePath" defaultValue={item.imagePath} />
          <input className="field max-w-24" name="sortOrder" type="number" defaultValue={item.sortOrder} />
          <div className="flex gap-2">
            <button className="gold-btn" type="submit">
              Save
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={async () => {
                await fetch(`/api/admin/test-results/${item.id}`, { method: "DELETE" });
                router.refresh();
              }}
            >
              Delete
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
