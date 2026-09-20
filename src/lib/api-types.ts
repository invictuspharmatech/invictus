export type ApiCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string | null;
  sortOrder: number;
};

export type ApiProduct = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  description: string;
  shortDescription: string;
  regularPrice: number;
  salePrice: number | null;
  image: string | null;
  stockStatus: string;
  stockQuantity: number | null;
  stockQuantityW1: number | null;
  stockQuantityW2: number | null;
  maxQuantityPerOrder: number | null;
  allowBackorder: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  warehouse: string;
  status: string;
  categoryIds?: string[];
  categories: { category: { id: string; slug: string; name: string } }[];
};

export type ApiOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  warehouse: string;
};

export type ApiOrder = {
  id: string;
  orderNumber: string;
  groupId: string;
  splitIndex: number;
  warehouse: string;
  status: string;
  merchandiseTotal: number;
  shippingTotal: number;
  grandTotal: number;
  customerName: string;
  customerEmail: string;
  commissionAmount: number;
  createdAt: string;
  items: ApiOrderItem[];
};

export type ApiPage = {
  id: string;
  slug: string;
  title: string;
  lede: string;
  body: string;
  isPublished: boolean;
  sortOrder: number;
  updatedAt?: string;
};

export type ApiFaq = {
  id: string;
  section: string;
  question: string;
  answer: string;
  isPublished: boolean;
  sortOrder: number;
};

export type ApiBanner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  ctaLabel: string;
  isActive: boolean;
  sortOrder: number;
};

export type ApiNav = {
  id: string;
  label: string;
  href: string;
  location: string;
  sortOrder: number;
  isActive: boolean;
};

export type ApiSetting = {
  key: string;
  value: string;
  label: string;
  group: string;
};

export type ApiTestResult = {
  id: string;
  productName: string;
  category: string;
  imagePath: string;
  sortOrder: number;
};

export type ApiEmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  hasPassword: boolean;
  useTls: boolean;
  useSsl: boolean;
  fromEmail: string;
  fromName: string;
  extraAdminEmails: string;
  warehouse1Emails: string;
  warehouse2Emails: string;
};

export type ApiEmailTemplate = {
  id: string;
  eventKey: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  enabled: boolean;
  notifyAdmin: boolean;
  notifyUser: boolean;
  notifyWarehouseManager: boolean;
  customEmails: string;
  sortOrder: number;
};

export type ApiWarehouseSettings = {
  splitEnabled: boolean;
  autoSplitEnabled: boolean;
  manualMoveEnabled: boolean;
  warehouseRequestEnabled: boolean;
};

export type ApiStockTransfer = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  status: string;
  note: string;
  requestedBy: string | null;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ApiFulfillmentRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  status: string;
  note: string;
  requestedBy: string | null;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
