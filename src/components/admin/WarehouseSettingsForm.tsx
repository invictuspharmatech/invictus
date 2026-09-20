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
