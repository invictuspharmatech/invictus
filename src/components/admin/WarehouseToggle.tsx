"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { warehouseLabel } from "@/lib/warehouse";

export function WarehouseToggle({
  id,
  warehouse,
}: {
  id: string;
  warehouse: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="ghost-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/products/${id}/warehouse`, { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      Move from {warehouseLabel(warehouse)}
    </button>
  );
}
