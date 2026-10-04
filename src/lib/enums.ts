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
  ON_HOLD: "ON_HOLD",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
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

export const CouponType = {
  PERCENT: "PERCENT",
  FIXED: "FIXED",
  FREE_SHIPPING: "FREE_SHIPPING",
} as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const AccountingTileKey = {
  ADMIN_25: "ADMIN_25",
  PARTY_1: "PARTY_1",
  PARTY_2: "PARTY_2",
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

export const BulkEmailStatus = {
  RUNNING: "running",
  PAUSED: "paused",
  STOPPED: "stopped",
  COMPLETED: "completed",
  INTERRUPTED: "interrupted",
} as const;
export type BulkEmailStatus = (typeof BulkEmailStatus)[keyof typeof BulkEmailStatus];

export const BulkEmailRecipientStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
} as const;
export type BulkEmailRecipientStatus =
  (typeof BulkEmailRecipientStatus)[keyof typeof BulkEmailRecipientStatus];
