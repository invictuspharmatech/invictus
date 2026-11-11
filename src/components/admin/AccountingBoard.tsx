"use client";

import { AccountingPeriod, AccountingTileKey, AccountingWarehouse } from "@/lib/enums";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/constants";
import {
  allocateForWarehouse,
  formatCrypto,
  parseMoneyInput,
  warehouseFilterLabel,
  type AccountingSaleRow,
  type AccountingSummary,
  type TileView,
} from "@/lib/accounting";
import type { RevenueSplit } from "@/lib/api-types";

type CalcMode = "manual" | "auto";

function calculatorStorageKey(period: AccountingPeriod, warehouse: AccountingWarehouse) {
  return `accounting-payout-calc:${period}:${warehouse}`;
}

function readStoredCalc(
  period: AccountingPeriod,
  warehouse: AccountingWarehouse,
): { mode: CalcMode; total: number | null } {
  if (typeof window === "undefined") return { mode: "manual", total: null };
  try {
    const raw = window.sessionStorage.getItem(calculatorStorageKey(period, warehouse));
    if (!raw) return { mode: "manual", total: null };
    const parsed = JSON.parse(raw) as { accumulatedUsd?: number; mode?: string };
    const mode: CalcMode = parsed.mode === "auto" ? "auto" : "manual";
    const total = Number(parsed.accumulatedUsd);
    if (!Number.isFinite(total) || total <= 0) return { mode, total: null };
    return { mode, total };
  } catch {
    return { mode: "manual", total: null };
  }
}

function writeStoredCalc(
  period: AccountingPeriod,
  warehouse: AccountingWarehouse,
  mode: CalcMode,
  total: number | null,
) {
  if (typeof window === "undefined") return;
  const key = calculatorStorageKey(period, warehouse);
  if (total == null || total <= 0) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, JSON.stringify({ mode, accumulatedUsd: total }));
}

function Amount({
  usd,
  cryptoAmount,
  cryptoCode,
}: {
  usd?: number | null;
  cryptoAmount?: number | null;
  cryptoCode?: string | null;
}) {
  return (
    <div>
      <p className="text-xl font-semibold tracking-tight sm:text-2xl">{formatMoney(usd ?? 0)}</p>
      {cryptoAmount != null && cryptoCode ? (
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
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
  countingSinceReset,
}: {
  tiles: TileView[];
  period: AccountingPeriod;
  warehouse: AccountingWarehouse;
  summary: AccountingSummary;
  sales: AccountingSaleRow[];
  split: RevenueSplit;
  countingSinceReset: boolean;
}) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [calcMode, setCalcMode] = useState<CalcMode>("manual");
  const [actualUsd, setActualUsd] = useState("");
  const [appliedUsd, setAppliedUsd] = useState<number | null>(null);

  const orderMerchandise = Number(summary.proceeds) || 0;

  useEffect(() => {
    const stored = readStoredCalc(period, warehouse);
    setCalcMode(stored.mode);
    setAppliedUsd(stored.total);
    setActualUsd("");
  }, [period, warehouse]);

  const manualSplit = useMemo(() => {
    if (appliedUsd == null) return null;
    return allocateForWarehouse(appliedUsd, summary.w1Share, warehouse, split);
  }, [appliedUsd, summary.w1Share, warehouse, split]);

  const pendingUsd = parseMoneyInput(actualUsd);
  const canCalculateManual = pendingUsd != null && pendingUsd > 0;
  const canCalculateAuto = orderMerchandise > 0;

  const adminRateLabel = useMemo(() => {
    const sample = allocateForWarehouse(100, summary.w1Share, warehouse, split);
    return sample.admin;
  }, [summary.w1Share, warehouse, split]);

  function calculateManual() {
    if (pendingUsd == null || pendingUsd <= 0) return;
    setCalcMode("manual");
    setAppliedUsd(pendingUsd);
    writeStoredCalc(period, warehouse, "manual", pendingUsd);
    setActualUsd("");
  }

  function calculateAuto() {
    if (orderMerchandise <= 0) return;
    setCalcMode("auto");
    setAppliedUsd(orderMerchandise);
    writeStoredCalc(period, warehouse, "auto", orderMerchandise);
    setActualUsd("");
  }

  function clearCalculated() {
    setAppliedUsd(null);
    setActualUsd("");
    writeStoredCalc(period, warehouse, calcMode, null);
  }

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
      setAppliedUsd(null);
      setActualUsd("");
      writeStoredCalc(period, warehouse, calcMode, null);
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  function tileUsd(tile: TileView): number {
    if (!manualSplit) return tile.amount;
    switch (tile.key) {
      case AccountingTileKey.ADMIN_25:
        return manualSplit.admin;
      case AccountingTileKey.PARTY_1:
        return manualSplit.party1;
      case AccountingTileKey.PARTY_2:
        return manualSplit.party2;
      case AccountingTileKey.SHIPPING:
        return tile.amount;
      default: {
        const exhaustive: never = tile.key;
        return exhaustive;
      }
    }
  }

  return (
    <div className="mt-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-muted-foreground">{warehouseFilterLabel(warehouse)}</p>
            {countingSinceReset ? (
              <p className="text-xs text-muted-foreground">Counting since last reset.</p>
            ) : null}
          </div>
          <button
            type="button"
            className="ghost-btn !px-3 !py-2"
            disabled={resetting}
            onClick={() => void resetAll()}
          >
            {resetting ? "Resetting…" : "Reset all to 0"}
          </button>
        </div>

        <article className="tile !p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Payout calculator · Admin ~{adminRateLabel.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Merchandise only for Admin / Party shares. Shipping fees always stay from orders
                since last Reset all (50/50). W1/W2 mix is also from those orders.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    calcMode === "manual"
                      ? "gold-btn !px-3 !py-2"
                      : "ghost-btn !px-3 !py-2"
                  }
                  onClick={() => setCalcMode("manual")}
                >
                  Manual amount
                </button>
                <button
                  type="button"
                  className={
                    calcMode === "auto" ? "gold-btn !px-3 !py-2" : "ghost-btn !px-3 !py-2"
                  }
                  onClick={() => setCalcMode("auto")}
                >
                  Auto from orders
                </button>
              </div>
            </div>
            {calcMode === "manual" ? (
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                USD amount
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="field !py-2 max-w-[10rem] font-mono text-sm"
                    inputMode="decimal"
                    placeholder="1000.00"
                    value={actualUsd}
                    onChange={(event) => setActualUsd(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        calculateManual();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="gold-btn !px-3 !py-2"
                    disabled={!canCalculateManual}
                    onClick={calculateManual}
                  >
                    Calculate
                  </button>
                </div>
              </label>
            ) : (
              <div className="grid gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Merchandise since last reset
                <div className="flex flex-wrap items-center gap-2">
                  <p className="field !py-2 max-w-[10rem] font-mono text-sm tabular-nums">
                    {formatMoney(orderMerchandise)}
                  </p>
                  <button
                    type="button"
                    className="gold-btn !px-3 !py-2"
                    disabled={!canCalculateAuto}
                    onClick={calculateAuto}
                  >
                    Calculate
                  </button>
                </div>
                <p className="normal-case tracking-normal text-muted-foreground">
                  Pulled from counted orders (shipping excluded).
                </p>
              </div>
            )}
          </div>
          {manualSplit && appliedUsd != null ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {calcMode === "auto" ? "Auto · " : "Manual · "}
                {formatMoney(appliedUsd)} → Admin {formatMoney(manualSplit.admin)} · Party 1{" "}
                {formatMoney(manualSplit.party1)} · Party 2 {formatMoney(manualSplit.party2)}
              </p>
              <button type="button" className="ghost-btn !px-2 !py-1 text-xs" onClick={clearCalculated}>
                Clear calculated
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Tiles show tracked order totals until you Calculate. Shipping tile is always from
              orders.
            </p>
          )}
        </article>

        <div className="grid gap-2 sm:grid-cols-3">
          <article className="tile !p-3" title="Merchandise only (shipping excluded).">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Proceeds received
            </p>
            <div className="mt-1.5">
              <Amount
                usd={manualSplit && appliedUsd != null ? appliedUsd : summary.proceeds}
                cryptoAmount={summary.cryptoProceeds}
                cryptoCode={summary.cryptoCode}
              />
            </div>
          </article>
          <article
            className="tile !p-3"
            title="X in the formula. Remainder is W2. Based on merchandise USD mix."
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              W1 merchandise share
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
              {(summary.w1Share * 100).toFixed(1)}%
            </p>
          </article>
          <article
            className="tile !p-3"
            title="Admin + Party 1 + Party 2. Must match merchandise proceeds."
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Allocation check
            </p>
            <div className="mt-1.5">
              {manualSplit && appliedUsd != null ? (
                <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {formatMoney(appliedUsd)}
                </p>
              ) : (
                <Amount
                  usd={summary.allocated}
                  cryptoAmount={summary.cryptoProceeds}
                  cryptoCode={summary.cryptoCode}
                />
              )}
            </div>
          </article>
        </div>

        <div className="grid gap-2 grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <article key={tile.key} className="tile !p-3" title={tile.description}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {tile.percentOfSale != null
                  ? `${tile.percentOfSale.toFixed(1)}% of merchandise`
                  : tile.key === AccountingTileKey.SHIPPING
                    ? "50/50 in Party 1 / Party 2"
                    : warehouseFilterLabel(warehouse)}
              </p>
              <h2 className="mt-1 text-sm font-semibold sm:text-base">{tile.title}</h2>
              <div className="mt-1.5">
                <Amount
                  usd={tileUsd(tile)}
                  cryptoAmount={tile.cryptoAmount}
                  cryptoCode={tile.cryptoCode}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {sales.length > 0 ? (
        <div className="mt-8 overflow-x-auto tile">
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
        <p className="mt-6 text-sm text-muted-foreground">No counted proceeds in this window.</p>
      )}
    </div>
  );
}
