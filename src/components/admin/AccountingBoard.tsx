"use client";

import { AccountingPeriod, AccountingWarehouse } from "@/lib/enums";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/constants";
import { warehouseFilterLabel, type TileView } from "@/lib/accounting";

export function AccountingBoard({
  tiles,
  period,
  warehouse,
}: {
  tiles: TileView[];
  period: AccountingPeriod;
  warehouse: AccountingWarehouse;
}) {
  const router = useRouter();

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => (
        <article key={tile.key} className="tile min-h-44">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {period.toLowerCase()} · {warehouseFilterLabel(warehouse)}
          </p>
          <h2 className="mt-2 text-lg">{tile.title}</h2>
          <p className="mt-4 text-3xl">{formatMoney(tile.amount)}</p>
          <p className="mt-3 text-sm text-muted-foreground">{tile.description}</p>
          <button
            type="button"
            className="ghost-btn mt-5"
            onClick={async () => {
              await fetch("/api/admin/accounting/reset", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ tileKey: tile.key, period, warehouse }),
              });
              router.refresh();
            }}
          >
            Reset to 0
          </button>
        </article>
      ))}
    </div>
  );
}
