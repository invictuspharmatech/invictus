"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiWarehouseSettings } from "@/lib/api-types";

export function WarehouseSettingsForm({ settings }: { settings: ApiWarehouseSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  return (
    <form
      className="tile mt-6 grid max-w-3xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSaved("");
        const form = new FormData(event.currentTarget);
        const res = await fetch("/api/admin/cms/warehouse-settings/", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            splitEnabled: form.get("splitEnabled") === "on",
            autoSplitEnabled: form.get("autoSplitEnabled") === "on",
            manualMoveEnabled: form.get("manualMoveEnabled") === "on",
            warehouseRequestEnabled: form.get("warehouseRequestEnabled") === "on",
            w1Name: String(form.get("w1Name") || ""),
            w1Contact: String(form.get("w1Contact") || ""),
            w1Notes: String(form.get("w1Notes") || ""),
            w2Name: String(form.get("w2Name") || ""),
            w2Contact: String(form.get("w2Contact") || ""),
            w2Notes: String(form.get("w2Notes") || ""),
          }),
        });
        if (!res.ok) {
          setError("Could not save warehouse settings.");
          return;
        }
        setSaved("Warehouse settings saved.");
        router.refresh();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3">
          <h2 className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Warehouse 1</h2>
          <label className="grid gap-1 text-sm">
            Name
            <input className="field" name="w1Name" defaultValue={settings.w1Name ?? "Warehouse 1"} />
          </label>
          <label className="grid gap-1 text-sm">
            Contact
            <input className="field" name="w1Contact" defaultValue={settings.w1Contact ?? ""} />
          </label>
          <label className="grid gap-1 text-sm">
            Notes
            <textarea className="field min-h-20" name="w1Notes" defaultValue={settings.w1Notes ?? ""} />
          </label>
        </div>
        <div className="grid gap-3">
          <h2 className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Warehouse 2</h2>
          <label className="grid gap-1 text-sm">
            Name
            <input className="field" name="w2Name" defaultValue={settings.w2Name ?? "Warehouse 2"} />
          </label>
          <label className="grid gap-1 text-sm">
            Contact
            <input className="field" name="w2Contact" defaultValue={settings.w2Contact ?? ""} />
          </label>
          <label className="grid gap-1 text-sm">
            Notes
            <textarea className="field min-h-20" name="w2Notes" defaultValue={settings.w2Notes ?? ""} />
          </label>
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input name="splitEnabled" type="checkbox" defaultChecked={settings.splitEnabled} />
        <span>
          <strong>Allow warehouse splits</strong>
          <span className="mt-1 block text-muted-foreground">
            Master switch. Off means each product stays with its home warehouse.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input name="autoSplitEnabled" type="checkbox" defaultChecked={settings.autoSplitEnabled} />
        <span>
          <strong>Auto-split on shortage</strong>
          <span className="mt-1 block text-muted-foreground">
            If the home warehouse does not have enough quantity, leftover units ship from the other
            warehouse. Shipping is $10 / $10 when both ship, or the full $20 if only one does.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input name="manualMoveEnabled" type="checkbox" defaultChecked={settings.manualMoveEnabled} />
        <span>
          <strong>Admin manual moves</strong>
          <span className="mt-1 block text-muted-foreground">
            Admins can move some or all items on an order to the other warehouse. A whole-order move
            takes the full shipping fee with it.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          name="warehouseRequestEnabled"
          type="checkbox"
          defaultChecked={settings.warehouseRequestEnabled}
        />
        <span>
          <strong>Warehouse requests</strong>
          <span className="mt-1 block text-muted-foreground">
            A warehouse can ask the other for stock or to take order items, without seeing the other
            warehouse’s counts. The other warehouse or an admin can accept or reject.
          </span>
        </span>
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
      <button className="gold-btn max-w-48" type="submit">
        Save settings
      </button>
    </form>
  );
}
