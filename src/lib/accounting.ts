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
  resetAt: string | null;
};

export function tileCopy(key: AccountingTileKey): {
  title: string;
  description: string;
} {
  switch (key) {
    case AccountingTileKey.SHIPPING_COLLECTED:
      return {
        title: "Shipping collected",
        description: "Shipping fees collected on paid orders.",
      };
    case AccountingTileKey.GROSS_25:
      return {
        title: "25% of gross sales",
        description: "25% of merchandise totals, excluding shipping.",
      };
    case AccountingTileKey.WAREHOUSE1_75:
      return {
        title: "Warehouse 1 · 75%",
        description:
          "75% of merchandise shipped from warehouse 1, excluding shipping.",
      };
    case AccountingTileKey.WAREHOUSE2_55:
      return {
        title: "Warehouse 2 · 55%",
        description:
          "55% of merchandise shipped from warehouse 2, excluding shipping.",
      };
    case AccountingTileKey.WAREHOUSE2_20:
      return {
        title: "Warehouse 2 · 20%",
        description:
          "20% of merchandise shipped from warehouse 2, excluding shipping.",
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
