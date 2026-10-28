"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiSetting } from "@/lib/api-types";
import { ProductMediaPicker } from "@/components/admin/ProductMediaPicker";

function isImageSetting(key: string): boolean {
  return key === "homepage_hero_image" || key.endsWith("_image") || key.endsWith("_image_path");
}

export function SettingsForm({ items }: { items: ApiSetting[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.value])),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="mt-6 grid max-w-3xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage("");
        const payload = items.map((item) => ({
          key: item.key,
          label: item.label,
          group: item.group,
          value: values[item.key] ?? item.value ?? "",
        }));
        const res = await fetch("/api/admin/cms/settings/", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSaving(false);
        if (!res.ok) {
          setMessage("Could not save settings.");
          return;
        }
        setMessage("Saved.");
        router.refresh();
      }}
    >
      {items.map((item) =>
        isImageSetting(item.key) ? (
          <ProductMediaPicker
            key={item.key}
            label={item.label || item.key}
            value={values[item.key] ?? ""}
            onChange={(path) => setValues((prev) => ({ ...prev, [item.key]: path }))}
            uploadFolder="site"
          />
        ) : (
          <label key={item.key} className="grid gap-1 text-sm">
            {item.label || item.key}
            <textarea
              className="field min-h-20"
              name={item.key}
              value={values[item.key] ?? ""}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [item.key]: event.target.value }))
              }
            />
          </label>
        ),
      )}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <button className="gold-btn max-w-40" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
