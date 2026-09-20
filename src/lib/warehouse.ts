import { WarehouseCode } from "@/lib/enums";

export function asWarehouse(value: string): WarehouseCode {
  if (value === WarehouseCode.WAREHOUSE_1 || value === WarehouseCode.WAREHOUSE_2) {
    return value;
  }
  return WarehouseCode.WAREHOUSE_2;
}

export function warehouseLabel(code: string): string {
  const resolved = asWarehouse(code);
  switch (resolved) {
    case WarehouseCode.WAREHOUSE_1:
      return "Warehouse 1";
    case WarehouseCode.WAREHOUSE_2:
      return "Warehouse 2";
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function warehouseShort(code: string): string {
  const resolved = asWarehouse(code);
  switch (resolved) {
    case WarehouseCode.WAREHOUSE_1:
      return "W1";
    case WarehouseCode.WAREHOUSE_2:
      return "W2";
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function defaultWarehouseForCategories(
  categorySlugs: string[],
): WarehouseCode {
  const warehouseOne = new Set([
    "peptides-glps",
    "peptides-and-glps",
    "aminos",
    "peptides",
  ]);
  if (categorySlugs.some((slug) => warehouseOne.has(slug))) {
    return WarehouseCode.WAREHOUSE_1;
  }
  return WarehouseCode.WAREHOUSE_2;
}

export function oppositeWarehouse(code: string): WarehouseCode {
  const resolved = asWarehouse(code);
  switch (resolved) {
    case WarehouseCode.WAREHOUSE_1:
      return WarehouseCode.WAREHOUSE_2;
    case WarehouseCode.WAREHOUSE_2:
      return WarehouseCode.WAREHOUSE_1;
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}
