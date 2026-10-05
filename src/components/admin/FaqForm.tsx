"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFaq } from "@/lib/api-types";

export function FaqForm({ item }: { item?: ApiFaq }) {
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
          section: String(form.get("section") || ""),
          question: String(form.get("question") || ""),
          answer: String(form.get("answer") || ""),
          sortOrder: Number(form.get("sortOrder") || 0),
          isPublished: form.get("isPublished") === "on",
        };
        const res = await fetch(item ? `/api/admin/cms/faq/${item.id}` : "/api/admin/cms/faq/", {
          method: item ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) {
          setError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Could not save FAQ item.",
          );
          return;
        }
        router.push("/admin/cms/faq");
        router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        Section
        <input
          className="field"
          name="section"
          defaultValue={item?.section}
          required
          placeholder="Shipping & Delivery"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Question
        <input className="field" name="question" defaultValue={item?.question} required />
      </label>
      <label className="grid gap-1 text-sm">
        Answer
        <textarea className="field min-h-32" name="answer" defaultValue={item?.answer} required />
      </label>
      <label className="grid gap-1 text-sm">
        Sort order
        <input
          className="field max-w-24"
          name="sortOrder"
          type="number"
          defaultValue={item?.sortOrder ?? 0}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isPublished" type="checkbox" defaultChecked={item?.isPublished ?? true} />
        Published
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button className="gold-btn max-w-40" type="submit" disabled={saving}>
          {saving ? "Saving…" : item ? "Update" : "Add"}
        </button>
        <button
          className="ghost-btn"
          type="button"
          onClick={() => router.push("/admin/cms/faq")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
