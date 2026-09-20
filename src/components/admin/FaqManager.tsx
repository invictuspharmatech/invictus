"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFaq } from "@/lib/api-types";

export function FaqManager({ items }: { items: ApiFaq[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(id: string | null, form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      section: String(data.get("section") || ""),
      question: String(data.get("question") || ""),
      answer: String(data.get("answer") || ""),
      sortOrder: Number(data.get("sortOrder") || 0),
      isPublished: data.get("isPublished") === "on",
    };
    const res = await fetch(id ? `/api/admin/cms/faq/${id}` : "/api/admin/cms/faq/", {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError("Could not save FAQ item.");
      return;
    }
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
        <h2 className="text-lg">Add FAQ</h2>
        <input className="field" name="section" placeholder="Section" required />
        <input className="field" name="question" placeholder="Question" required />
        <textarea className="field min-h-24" name="answer" placeholder="Answer" required />
        <input className="field max-w-24" name="sortOrder" type="number" defaultValue={items.length} />
        <label className="flex items-center gap-2 text-sm">
          <input name="isPublished" type="checkbox" defaultChecked />
          Published
        </label>
        <button className="gold-btn max-w-40" type="submit">
          Add
        </button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {items.map((item) => (
        <form
          key={item.id}
          className="tile grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await save(item.id, event.currentTarget);
          }}
        >
          <input className="field" name="section" defaultValue={item.section} />
          <input className="field" name="question" defaultValue={item.question} />
          <textarea className="field min-h-24" name="answer" defaultValue={item.answer} />
          <input className="field max-w-24" name="sortOrder" type="number" defaultValue={item.sortOrder} />
          <label className="flex items-center gap-2 text-sm">
            <input name="isPublished" type="checkbox" defaultChecked={item.isPublished} />
            Published
          </label>
          <div className="flex gap-2">
            <button className="gold-btn" type="submit">
              Save
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={async () => {
                await fetch(`/api/admin/cms/faq/${item.id}`, { method: "DELETE" });
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
