"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiEmailTemplate } from "@/lib/api-types";

export function EmailTemplateManager({ items }: { items: ApiEmailTemplate[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(item: ApiEmailTemplate, form: HTMLFormElement) {
    setError("");
    const data = new FormData(form);
    const payload = {
      eventKey: item.eventKey,
      name: item.name,
      description: item.description,
      subject: String(data.get("subject") || ""),
      body: String(data.get("body") || ""),
      enabled: data.get("enabled") === "on",
      notifyAdmin: data.get("notifyAdmin") === "on",
      notifyUser: data.get("notifyUser") === "on",
      notifyWarehouseManager: data.get("notifyWarehouseManager") === "on",
      customEmails: String(data.get("customEmails") || ""),
      sortOrder: item.sortOrder,
    };
    const res = await fetch(`/api/admin/cms/email-templates/${item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError(`Could not save ${item.name}.`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-10 space-y-6">
      <div>
        <h2 className="display-font text-2xl">Templates and recipients</h2>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {items.map((item) => (
        <form
          key={item.id}
          className="tile grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await save(item, event.currentTarget);
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg">{item.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="enabled" type="checkbox" defaultChecked={item.enabled} />
              Enabled
            </label>
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Recipients
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2" title="Every active Admin and Superuser account email">
              <input name="notifyAdmin" type="checkbox" defaultChecked={item.notifyAdmin} />
              All admin accounts
            </label>
            <label className="flex items-center gap-2">
              <input name="notifyUser" type="checkbox" defaultChecked={item.notifyUser} />
              Customer / user
            </label>
            <label className="flex items-center gap-2">
              <input
                name="notifyWarehouseManager"
                type="checkbox"
                defaultChecked={item.notifyWarehouseManager}
              />
              Warehouse manager
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Custom list (manual)
            <textarea
              className="field min-h-16"
              name="customEmails"
              placeholder="e.g. admin@invictuspharma.net — optional"
              defaultValue={item.customEmails}
            />
          </label>
          <input className="field" name="subject" defaultValue={item.subject} required />
          <label className="grid gap-1 text-sm">
            Inner message
            <textarea className="field min-h-36" name="body" defaultValue={item.body} required />
          </label>
          <button className="gold-btn max-w-40" type="submit">
            Save template
          </button>
        </form>
      ))}
    </div>
  );
}
