import {
  AccountingPeriod,
  AccountingTileKey,
  AccountingWarehouse,
} from "@/lib/enums";

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
  w1Share: number;
  allocated: number;
};

export function tileCopy(key: AccountingTileKey): {
  title: string;
  description: string;
} {
  switch (key) {
    case AccountingTileKey.ADMIN_25:
      return {
        title: "Admin · 25%",
        description: "25% of proceeds received. Fixed on every sale.",
      };
    case AccountingTileKey.PARTY_1:
      return {
        title: "Party 1",
        description: "60% × the W1 merchandise share of each sale.",
      };
    case AccountingTileKey.PARTY_2:
      return {
        title: "Party 2",
        description: "75% minus Party 1’s share. The three parties always total 100%.",
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
