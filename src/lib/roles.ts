import { Role, WarehouseCode } from "@/lib/enums";

export function asRole(value: string): Role {
  if (
    value === Role.SUPERUSER ||
    value === Role.ADMIN ||
    value === Role.WAREHOUSE_1 ||
    value === Role.WAREHOUSE_2 ||
    value === Role.CUSTOMER
  ) {
    return value;
  }
  return Role.CUSTOMER;
}

export function isFullAdmin(role: string): boolean {
  const resolved = asRole(role);
  switch (resolved) {
    case Role.SUPERUSER:
    case Role.ADMIN:
      return true;
    case Role.WAREHOUSE_1:
    case Role.WAREHOUSE_2:
    case Role.CUSTOMER:
      return false;
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function isStaff(role: string): boolean {
  const resolved = asRole(role);
  switch (resolved) {
    case Role.SUPERUSER:
    case Role.ADMIN:
    case Role.WAREHOUSE_1:
    case Role.WAREHOUSE_2:
      return true;
    case Role.CUSTOMER:
      return false;
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function staffWarehouse(role: string): WarehouseCode | null {
  const resolved = asRole(role);
  switch (resolved) {
    case Role.WAREHOUSE_1:
      return WarehouseCode.WAREHOUSE_1;
    case Role.WAREHOUSE_2:
      return WarehouseCode.WAREHOUSE_2;
    case Role.SUPERUSER:
    case Role.ADMIN:
    case Role.CUSTOMER:
      return null;
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function roleLabel(role: string): string {
  const resolved = asRole(role);
  switch (resolved) {
    case Role.SUPERUSER:
      return "Super user";
    case Role.ADMIN:
      return "Admin";
    case Role.WAREHOUSE_1:
      return "Warehouse 1";
    case Role.WAREHOUSE_2:
      return "Warehouse 2";
    case Role.CUSTOMER:
      return "Customer";
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}
