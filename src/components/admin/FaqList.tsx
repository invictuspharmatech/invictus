"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiFaq } from "@/lib/api-types";

export function FaqList({ items }: { items: ApiFaq[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.section.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">FAQ</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Questions and answers on the public FAQ page, grouped by section. Edit an existing
            item or add a new one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/faq" target="_blank" className="ghost-btn">
            View on site
          </Link>
          <Link href="/admin/cms/faq/new" className="gold-btn">
            Add FAQ
          </Link>
        </div>
      </div>
      <div className="mt-6">
        <input
          className="field max-w-md"
          placeholder="Search questions..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="tile mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Section</th>
              <th>Question</th>
              <th>Status</th>
              <th>Sort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="py-6 text-muted-foreground" colSpan={5}>
                  {items.length === 0
                    ? "No FAQ items yet. Add one to show it on /faq."
                    : "No matching FAQ items."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-border/40">
                  <td className="py-3">{item.section}</td>
                  <td className="max-w-xl">{item.question}</td>
                  <td>{item.isPublished ? "Published" : "Draft"}</td>
                  <td>{item.sortOrder}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/cms/faq/${item.id}`} className="text-sm text-signal">
                      Edit
                    </Link>
                    <button
                      className="ml-4 text-sm text-red-400"
                      type="button"
                      onClick={async () => {
                        if (!confirm("Delete this FAQ item?")) return;
                        await fetch(`/api/admin/cms/faq/${item.id}`, { method: "DELETE" });
                        router.refresh();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
