"use client";

import { useRouter } from "next/navigation";
import type { ApiSetting } from "@/lib/api-types";

export function SettingsForm({ items }: { items: ApiSetting[] }) {
  const router = useRouter();

  return (
    <form
      className="mt-6 grid max-w-3xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = items.map((item) => ({
          key: item.key,
          label: item.label,
          group: item.group,
          value: String(form.get(item.key) || ""),
        }));
        await fetch("/api/admin/cms/settings/", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        router.refresh();
      }}
    >
      {items.map((item) => (
        <label key={item.key} className="grid gap-1 text-sm">
          {item.label || item.key}
          <textarea className="field min-h-20" name={item.key} defaultValue={item.value} />
        </label>
      ))}
      <button className="gold-btn max-w-40" type="submit">
        Save settings
      </button>
    </form>
  );
}
