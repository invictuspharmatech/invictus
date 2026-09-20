"use client";

import { useRouter } from "next/navigation";
import type { ApiBanner } from "@/lib/api-types";

export function BannerManager({ items }: { items: ApiBanner[] }) {
  const router = useRouter();

  async function save(id: string | null, form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      title: String(data.get("title") || ""),
      subtitle: String(data.get("subtitle") || ""),
      image: String(data.get("image") || ""),
      href: String(data.get("href") || ""),
      ctaLabel: String(data.get("ctaLabel") || ""),
      sortOrder: Number(data.get("sortOrder") || 0),
      isActive: data.get("isActive") === "on",
    };
    await fetch(id ? `/api/admin/cms/banners/${id}` : "/api/admin/cms/banners/", {
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
        <h2 className="text-lg">Add banner</h2>
        <input className="field" name="title" placeholder="Title" required />
        <input className="field" name="subtitle" placeholder="Subtitle" />
        <input className="field" name="image" placeholder="Image URL or path" />
        <input className="field" name="href" placeholder="/products" />
        <input className="field" name="ctaLabel" placeholder="CTA label" />
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked />
          Active
        </label>
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
          <input className="field" name="title" defaultValue={item.title} />
          <input className="field" name="subtitle" defaultValue={item.subtitle} />
          <input className="field" name="image" defaultValue={item.image} />
          <input className="field" name="href" defaultValue={item.href} />
          <input className="field" name="ctaLabel" defaultValue={item.ctaLabel} />
          <input className="field max-w-24" name="sortOrder" type="number" defaultValue={item.sortOrder} />
          <label className="flex items-center gap-2 text-sm">
            <input name="isActive" type="checkbox" defaultChecked={item.isActive} />
            Active
          </label>
          <div className="flex gap-2">
            <button className="gold-btn" type="submit">
              Save
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={async () => {
                await fetch(`/api/admin/cms/banners/${item.id}`, { method: "DELETE" });
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
