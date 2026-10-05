"use client";

import { AccountingPeriod, AccountingWarehouse } from "@/lib/enums";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/constants";
import {
  formatCrypto,
  warehouseFilterLabel,
  type AccountingSaleRow,
  type AccountingSummary,
  type TileView,
} from "@/lib/accounting";

function Amount({
  usd,
  cryptoAmount,
  cryptoCode,
}: {
  usd: number;
  cryptoAmount?: number | null;
  cryptoCode?: string | null;
}) {
  return (
    <div>
      <p className="text-3xl">{formatMoney(usd)}</p>
      {cryptoAmount != null && cryptoCode ? (
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {formatCrypto(cryptoAmount, cryptoCode)}
        </p>
      ) : null}
    </div>
  );
}

export function AccountingBoard({
  tiles,
  period,
  warehouse,
  summary,
  sales,
}: {
  tiles: TileView[];
  period: AccountingPeriod;
  warehouse: AccountingWarehouse;
  summary: AccountingSummary;
  sales: AccountingSaleRow[];
}) {
  const router = useRouter();

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Proceeds received
          </p>
          <Amount
            usd={summary.proceeds}
            cryptoAmount={summary.cryptoProceeds}
            cryptoCode={summary.cryptoCode}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Processing / completed in this window.
          </p>
        </article>
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            W1 merchandise share
          </p>
          <p className="mt-2 text-3xl">{(summary.w1Share * 100).toFixed(1)}%</p>
          <p className="mt-3 text-sm text-muted-foreground">
            X in the formula. Remainder is W2. Based on merchandise, then applied to
            proceeds.
          </p>
        </article>
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Allocation check
          </p>
          <p className="mt-2 text-3xl">{formatMoney(summary.allocated)}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Admin + Party 1 + Party 2. Must match proceeds.
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <article key={tile.key} className="tile min-h-44">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {period.toLowerCase()} · {warehouseFilterLabel(warehouse)}
              {tile.percentOfSale != null ? ` · ${tile.percentOfSale.toFixed(1)}% of proceeds` : ""}
            </p>
            <h2 className="mt-2 text-lg">{tile.title}</h2>
            <div className="mt-4">
              <Amount
                usd={tile.amount}
                cryptoAmount={tile.cryptoAmount}
                cryptoCode={tile.cryptoCode}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{tile.description}</p>
            {tile.resetAt ? (
              <p className="mt-2 text-xs text-muted-foreground">Counting since last reset.</p>
            ) : null}
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

      {sales.length > 0 ? (
        <div className="overflow-x-auto tile">
          <h2 className="text-lg">Sales in this window</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Full period. Party tiles can be reset separately after you pay that share.
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Order</th>
                <th>W1 share</th>
                <th>Proceeds</th>
                <th>Admin</th>
                <th>Party 1</th>
                <th>Party 2</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={row.groupId} className="border-t border-border/40">
                  <td className="py-3 font-mono text-xs">{row.orderNumbers.join(", ")}</td>
                  <td>{(row.w1Share * 100).toFixed(1)}%</td>
                  <td>
                    {formatMoney(row.proceeds)}
                    {row.cryptoProceeds != null && row.cryptoCode ? (
                      <div className="text-xs text-muted-foreground">
                        {formatCrypto(row.cryptoProceeds, row.cryptoCode)}
                      </div>
                    ) : null}
                  </td>
                  <td>{formatMoney(row.admin)}</td>
                  <td>{formatMoney(row.party1)}</td>
                  <td>{formatMoney(row.party2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No counted proceeds in this window.</p>
      )}
    </div>
  );
}
