"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiPage } from "@/lib/api-types";

export function CmsPageForm({ page }: { page?: ApiPage }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="mt-6 grid max-w-3xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const payload = {
          slug: String(form.get("slug") || ""),
          title: String(form.get("title") || ""),
          lede: String(form.get("lede") || ""),
          body: String(form.get("body") || ""),
          isPublished: form.get("isPublished") === "on",
          sortOrder: Number(form.get("sortOrder") || 0),
        };
        const res = await fetch(
          page ? `/api/admin/cms/pages/${page.id}` : "/api/admin/cms/pages/",
          {
            method: page ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) {
          setError(data.error || "Could not save page.");
          return;
        }
        router.push("/admin/cms/pages");
        router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        Title
        <input className="field" name="title" defaultValue={page?.title} required />
      </label>
      <label className="grid gap-1 text-sm">
        Slug
        <input className="field" name="slug" defaultValue={page?.slug} required />
      </label>
      <label className="grid gap-1 text-sm">
        Lede
        <input className="field" name="lede" defaultValue={page?.lede} />
      </label>
      <label className="grid gap-1 text-sm">
        Body (HTML)
        <textarea className="field min-h-64" name="body" defaultValue={page?.body} />
      </label>
      <label className="grid gap-1 text-sm">
        Sort
        <input
          className="field max-w-24"
          name="sortOrder"
          type="number"
          defaultValue={page?.sortOrder ?? 0}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isPublished" type="checkbox" defaultChecked={page?.isPublished ?? true} />
        Published
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button className="gold-btn max-w-40" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save page"}
      </button>
    </form>
  );
}
