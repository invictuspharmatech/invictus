import {
  AccountingPeriod,
  AccountingTileKey,
  AccountingWarehouse,
} from "@/lib/enums";
import type { RevenueSplit } from "@/lib/api-types";

export type TileView = {
  key: AccountingTileKey;
  title: string;
  description: string;
  amount: number;
  cryptoAmount?: number | null;
  cryptoCode?: string | null;
  percentOfSale?: number;
  resetAt: string | null;
};

export type AccountingSaleRow = {
  groupId: string;
  orderNumbers: string[];
  w1Share: number;
  proceeds: number;
  shipping?: number;
  admin: number;
  party1: number;
  party2: number;
  cryptoProceeds?: number | null;
  cryptoCode?: string | null;
};

export type AccountingSummary = {
  proceeds: number;
  cryptoProceeds?: number | null;
  cryptoCode?: string | null;
  shipping?: number;
  cryptoShipping?: number | null;
  w1Share: number;
  allocated: number;
  resetAt?: string | null;
};

export function tileCopy(key: AccountingTileKey): {
  title: string;
  description: string;
} {
  switch (key) {
    case AccountingTileKey.ADMIN_25:
      return {
        title: "Admin",
        description: "Configured admin share of merchandise proceeds (shipping excluded).",
      };
    case AccountingTileKey.PARTY_1:
      return {
        title: "Party 1",
        description: "Configured Party 1 share of merchandise, weighted by mix.",
      };
    case AccountingTileKey.PARTY_2:
      return {
        title: "Party 2",
        description: "Remainder of merchandise so the three parties total 100%.",
      };
    case AccountingTileKey.SHIPPING:
      return {
        title: "Shipping fees",
        description: "Always 50/50 W1 · W2 of shipping collected. Kept out of party splits.",
      };
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function periodLabel(period: AccountingPeriod): string {
  switch (period) {
    case AccountingPeriod.DAY:
      return "Day";
    case AccountingPeriod.WEEK:
      return "Week";
    case AccountingPeriod.MONTH:
      return "Month";
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

export function warehouseFilterLabel(warehouse: AccountingWarehouse): string {
  switch (warehouse) {
    case AccountingWarehouse.BOTH:
      return "Both warehouses";
    case AccountingWarehouse.WAREHOUSE_1:
      return "Warehouse 1";
    case AccountingWarehouse.WAREHOUSE_2:
      return "Warehouse 2";
    default: {
      const exhaustive: never = warehouse;
      return exhaustive;
    }
  }
}

export function asAccountingWarehouse(value: string | undefined): AccountingWarehouse {
  if (
    value === AccountingWarehouse.WAREHOUSE_1 ||
    value === AccountingWarehouse.WAREHOUSE_2 ||
    value === AccountingWarehouse.BOTH
  ) {
    return value;
  }
  return AccountingWarehouse.BOTH;
}

export function formatCrypto(amount: number, code: string): string {
  const digits = amount >= 1 ? 4 : 8;
  return `${amount.toFixed(digits)} ${code}`;
}

function clampShare(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Mirrors backend allocate_sale: admin cut first, then party shares of the full pot. */
export function allocateSale(
  proceeds: number,
  w1Share: number,
  split: Pick<
    RevenueSplit,
    "w1Admin" | "w1Party1" | "w1Party2" | "w2Admin" | "w2Party1" | "w2Party2"
  >,
): { admin: number; party1: number; party2: number } {
  const amount = Number.isFinite(proceeds) && proceeds > 0 ? proceeds : 0;
  const x = clampShare(w1Share);
  const adminRate = (split.w1Admin * x + split.w2Admin * (1 - x)) / 100;
  const party1Rate = (split.w1Party1 * x + split.w2Party1 * (1 - x)) / 100;
  const admin = amount * adminRate;
  const party1 = amount * party1Rate;
  const party2 = amount - admin - party1;
  return { admin, party1, party2 };
}

export function allocateForWarehouse(
  proceeds: number,
  w1Share: number,
  warehouse: AccountingWarehouse,
  split: Pick<
    RevenueSplit,
    "w1Admin" | "w1Party1" | "w1Party2" | "w2Admin" | "w2Party1" | "w2Party2"
  >,
): { admin: number; party1: number; party2: number } {
  const x = clampShare(w1Share);
  switch (warehouse) {
    case AccountingWarehouse.WAREHOUSE_1:
      return allocateSale(proceeds * x, 1, split);
    case AccountingWarehouse.WAREHOUSE_2:
      return allocateSale(proceeds * (1 - x), 0, split);
    case AccountingWarehouse.BOTH:
      return allocateSale(proceeds, x, split);
    default: {
      const exhaustive: never = warehouse;
      return exhaustive;
    }
  }
}

export function parseBtcInput(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
