"use client";

import { AccountingPeriod, AccountingTileKey, AccountingWarehouse } from "@/lib/enums";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/constants";
import {
  allocateForWarehouse,
  formatCrypto,
  parseBtcInput,
  warehouseFilterLabel,
  type AccountingSaleRow,
  type AccountingSummary,
  type TileView,
} from "@/lib/accounting";
import type { RevenueSplit } from "@/lib/api-types";

function Amount({
  usd,
  cryptoAmount,
  cryptoCode,
  emphasizeCrypto = false,
}: {
  usd?: number | null;
  cryptoAmount?: number | null;
  cryptoCode?: string | null;
  emphasizeCrypto?: boolean;
}) {
  if (emphasizeCrypto && cryptoAmount != null && cryptoCode) {
    return (
      <div>
        <p className="font-mono text-3xl">{formatCrypto(cryptoAmount, cryptoCode)}</p>
        {usd != null ? (
          <p className="mt-1 text-sm text-muted-foreground">Tracked {formatMoney(usd)}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div>
      <p className="text-3xl">{formatMoney(usd ?? 0)}</p>
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
  split,
}: {
  tiles: TileView[];
  period: AccountingPeriod;
  warehouse: AccountingWarehouse;
  summary: AccountingSummary;
  sales: AccountingSaleRow[];
  split: RevenueSplit;
}) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [actualBtc, setActualBtc] = useState("");
  const countingSinceReset = Boolean(summary.resetAt || tiles.some((tile) => tile.resetAt));

  const manualBtc = parseBtcInput(actualBtc);
  const manualSplit = useMemo(() => {
    if (manualBtc == null) return null;
    return allocateForWarehouse(manualBtc, summary.w1Share, warehouse, split);
  }, [manualBtc, summary.w1Share, warehouse, split]);

  const adminRateLabel = useMemo(() => {
    const sample = allocateForWarehouse(100, summary.w1Share, warehouse, split);
    return sample.admin;
  }, [summary.w1Share, warehouse, split]);

  async function resetAll() {
    if (
      !window.confirm(
        "Reset all accounting tiles to 0 for this period and warehouse? Use this after a payout so the next pay period starts clean.",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await fetch("/api/admin/accounting/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resetAll: true, period, warehouse }),
      });
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  function tileCrypto(tile: TileView): number | null | undefined {
    if (!manualSplit) return tile.cryptoAmount;
    switch (tile.key) {
      case AccountingTileKey.ADMIN_25:
        return manualSplit.admin;
      case AccountingTileKey.PARTY_1:
        return manualSplit.party1;
      case AccountingTileKey.PARTY_2:
        return manualSplit.party2;
      case AccountingTileKey.SHIPPING:
        // Shipping stays on tracked invoice amounts — not part of the BTC payout split.
        return tile.cryptoAmount;
      default: {
        const exhaustive: never = tile.key;
        return exhaustive;
      }
    }
  }

  function tileEmphasizeCrypto(tile: TileView): boolean {
    return Boolean(manualSplit) && tile.key !== AccountingTileKey.SHIPPING;
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{warehouseFilterLabel(warehouse)}</p>
          {countingSinceReset ? (
            <p className="mt-1 text-xs text-muted-foreground">Counting since last reset.</p>
          ) : null}
        </div>
        <button
          type="button"
          className="ghost-btn"
          disabled={resetting}
          onClick={() => void resetAll()}
        >
          {resetting ? "Resetting…" : "Reset all to 0"}
        </button>
      </div>

      <article className="tile max-w-xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Actual BTC received
        </p>
        <h2 className="mt-2 text-lg">Payout calculator</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Invoice BTC can drift with rate changes. Enter merchandise BTC actually received
          (shipping excluded — e.g. <code>0.05</code>). Admin takes ~{adminRateLabel.toFixed(1)}%
          off the top using the configured warehouse mix, then Party 1 / Party 2 get the rest.
          Shipping stays on its own tile. Leave blank to show tracked invoice totals only.
        </p>
        <label className="mt-4 grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          BTC amount
          <div className="flex items-center gap-2">
            <input
              className="field max-w-xs font-mono"
              inputMode="decimal"
              placeholder="0.05"
              value={actualBtc}
              onChange={(event) => setActualBtc(event.target.value)}
            />
            <span className="text-sm normal-case tracking-normal text-muted-foreground">BTC</span>
          </div>
        </label>
        {manualSplit && manualBtc != null ? (
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            {formatCrypto(manualBtc, "BTC")} → Admin {formatCrypto(manualSplit.admin, "BTC")} ·
            Party 1 {formatCrypto(manualSplit.party1, "BTC")} · Party 2{" "}
            {formatCrypto(manualSplit.party2, "BTC")}
          </p>
        ) : null}
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Proceeds received
          </p>
          <Amount
            usd={summary.proceeds}
            cryptoAmount={manualBtc ?? summary.cryptoProceeds}
            cryptoCode={manualSplit ? "BTC" : summary.cryptoCode}
            emphasizeCrypto={Boolean(manualSplit)}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {manualSplit
              ? "Using your entered merchandise BTC for the party split below."
              : "Merchandise only (shipping excluded) for processing / completed orders."}
          </p>
        </article>
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            W1 merchandise share
          </p>
          <p className="mt-2 text-3xl">{(summary.w1Share * 100).toFixed(1)}%</p>
          <p className="mt-3 text-sm text-muted-foreground">
            X in the formula. Remainder is W2. Based on merchandise, then applied to
            merchandise proceeds.
          </p>
        </article>
        <article className="tile">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Allocation check
          </p>
          {manualSplit && manualBtc != null ? (
            <>
              <p className="mt-2 font-mono text-3xl">{formatCrypto(manualBtc, "BTC")}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Admin + Party 1 + Party 2 from your BTC entry (must match). Shipping is separate.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-3xl">{formatMoney(summary.allocated)}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Admin + Party 1 + Party 2. Must match merchandise proceeds (not shipping).
              </p>
            </>
          )}
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const cryptoAmount = tileCrypto(tile);
          const emphasize = tileEmphasizeCrypto(tile);
          return (
            <article key={tile.key} className="tile min-h-44">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {warehouseFilterLabel(warehouse)}
                {tile.percentOfSale != null
                  ? ` · ${tile.percentOfSale.toFixed(1)}% of merchandise`
                  : tile.key === AccountingTileKey.SHIPPING
                    ? " · not in party split"
                    : ""}
              </p>
              <h2 className="mt-2 text-lg">{tile.title}</h2>
              <div className="mt-4">
                <Amount
                  usd={tile.amount}
                  cryptoAmount={cryptoAmount}
                  cryptoCode={emphasize ? "BTC" : tile.cryptoCode}
                  emphasizeCrypto={emphasize}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{tile.description}</p>
            </article>
          );
        })}
      </div>

      {sales.length > 0 ? (
        <div className="overflow-x-auto tile">
          <h2 className="text-lg">Sales in this window</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders counted since the last Reset all (or the start of this period).
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Order</th>
                <th>W1 share</th>
                <th>Merchandise</th>
                <th>Shipping</th>
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
                  <td>{formatMoney(row.shipping ?? 0)}</td>
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
