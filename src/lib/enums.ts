export const Role = {
  SUPERUSER: "SUPERUSER",
  ADMIN: "ADMIN",
  WAREHOUSE_1: "WAREHOUSE_1",
  WAREHOUSE_2: "WAREHOUSE_2",
  CUSTOMER: "CUSTOMER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const WarehouseCode = {
  WAREHOUSE_1: "WAREHOUSE_1",
  WAREHOUSE_2: "WAREHOUSE_2",
} as const;
export type WarehouseCode = (typeof WarehouseCode)[keyof typeof WarehouseCode];

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const CommissionType = {
  PERCENT: "PERCENT",
  FIXED: "FIXED",
} as const;
export type CommissionType = (typeof CommissionType)[keyof typeof CommissionType];

export const PayoutType = {
  COMMISSION: "COMMISSION",
  STORE_CREDIT: "STORE_CREDIT",
} as const;
export type PayoutType = (typeof PayoutType)[keyof typeof PayoutType];

export const AccountingTileKey = {
  SHIPPING_COLLECTED: "SHIPPING_COLLECTED",
  GROSS_25: "GROSS_25",
  WAREHOUSE1_75: "WAREHOUSE1_75",
  WAREHOUSE2_55: "WAREHOUSE2_55",
  WAREHOUSE2_20: "WAREHOUSE2_20",
} as const;
export type AccountingTileKey =
  (typeof AccountingTileKey)[keyof typeof AccountingTileKey];

export const AccountingPeriod = {
  DAY: "DAY",
  WEEK: "WEEK",
  MONTH: "MONTH",
} as const;
export type AccountingPeriod =
  (typeof AccountingPeriod)[keyof typeof AccountingPeriod];

export const AccountingWarehouse = {
  BOTH: "BOTH",
  WAREHOUSE_1: "WAREHOUSE_1",
  WAREHOUSE_2: "WAREHOUSE_2",
} as const;
export type AccountingWarehouse =
  (typeof AccountingWarehouse)[keyof typeof AccountingWarehouse];
