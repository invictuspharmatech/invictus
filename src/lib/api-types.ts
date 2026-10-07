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
  createdAt?: string | null;
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

export type ApiBtcInvoice = {
  invoiceId: string;
  status: string;
  amount: number;
  currency: string;
  cryptoCode: string;
  cryptoAmount: string;
  paymentAddress: string;
  expiresAt: string | null;
  checkoutLink: string | null;
  checkoutClosed: boolean;
};

export type ApiShippingLabel = {
  id: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  carrier: string;
  serviceType: string;
  source: string;
  createdAt: string;
};

export type ApiOrder = {
  id: string;
  orderNumber: string;
  groupId: string;
  splitIndex: number;
  warehouse: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  merchandiseTotal: number;
  shippingTotal: number;
  grandTotal: number;
  customerName: string;
  customerEmail: string;
  commissionAmount: number;
  couponCode?: string;
  discountTotal?: number;
  shippingWaived?: boolean;
  createdAt: string;
  trackingNumber?: string;
  userId?: string | null;
  shippingLine1?: string;
  shippingLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostal?: string;
  shippingCountry?: string;
  notes?: string;
  items: ApiOrderItem[];
  btcInvoice?: ApiBtcInvoice | null;
  shippingLabels?: ApiShippingLabel[];
};

export type ApiPostageSettings = {
  apiUrl: string;
  apiKey: string;
  hasSecret: boolean;
  isConfigured: boolean;
};

export type ApiPostageSender = {
  id: string;
  fromName: string;
  fromStreet: string;
  fromApt: string;
  fromCity: string;
  fromState: string;
  fromZip: string;
  fromCountry: string;
  fromPhone: string;
  isDefault: boolean;
};

export type ApiPostageCredits = {
  credits: string;
  address?: string;
  amount?: string;
  currency?: string;
  purchaseId?: string;
  id?: string;
  timestamp?: string;
};

export type RevenueSplit = {
  w1Admin: number;
  w1Party1: number;
  w1Party2: number;
  w2Admin: number;
  w2Party1: number;
  w2Party2: number;
  defaults: {
    w1Admin: number;
    w1Party1: number;
    w1Party2: number;
    w2Admin: number;
    w2Party1: number;
    w2Party2: number;
  };
};

export type AdminOrdersResponse = {
  orders: ApiOrder[];
  counts: Record<string, number>;
};

export type ApiBtcPaySettings = {
  serverUrl: string;
  apiKey: string | null;
  storeId: string;
  webhookSecret: string | null;
  isConfigured: boolean;
  webhookUrl: string;
  invoiceExpirationMinutes: number;
  defaultCustomerMessage: string;
  webhookStatus: {
    configured: boolean;
    message: string;
    webhookId?: string;
  };
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

import type { SelectableColorMode } from "@/lib/selectable-colors";

export type BannerBgMode = SelectableColorMode;

export type BannerTextMode = "light" | "dark" | "accent";

export type ApiBanner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  ctaLabel: string;
  isActive: boolean;
  sortOrder: number;
  bgColorMode?: BannerBgMode;
  textColorMode?: BannerTextMode;
};

export type ApiBannerRuntime = {
  items: ApiBanner[];
  enabled: boolean;
  displayMode: "marquee" | "slider";
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
  wrapperHtml: string;
  defaultWrapperHtml: string;
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
  w1Name?: string;
  w1Contact?: string;
  w1Notes?: string;
  w2Name?: string;
  w2Contact?: string;
  w2Notes?: string;
};

export type ApiAdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isAffiliate: boolean;
  affiliateCode: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ApiWarehouseCard = {
  code: string;
  name: string;
  contact: string;
  notes: string;
  productCount: number;
  lowStockCount: number;
  processingCount: number;
  openOrderCount: number;
  openOrderValue: number;
};

export type ApiDashboardTile = {
  id: string;
  row: number;
  sort: number;
  color: string;
  colSpan: number;
  label: string;
  value: number;
  format: "count" | "currency";
  href: string;
  periodHint: string;
  supportsDynamicColor: boolean;
  icon?: string;
  footerLabel?: string;
  kind?: "link" | "shipping_reset" | "top_category" | "products_breakdown";
  extraLabel?: string;
  badges?: { text: string }[];
};

export type ApiDashboardOverview = {
  productCount: number;
  openOrderValue: number;
  openOrderCount: number;
  orderCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingAffiliates: number;
  userCount: number;
  warehouse: string;
  period?: { todayLabel: string; weekLabel: string; monthLabel: string };
  salesToday: number;
  salesThisWeek: number;
  salesThisMonth: number;
  shippingSinceReset: number;
  shippingThisWeek: number;
  ordersPending: number;
  ordersFailed: number;
  ordersProcessing: number;
  ordersCompleted: number;
  topCategoryMonth: { name: string; count: number };
  categoriesTotal: number;
  warehousesTotal: number;
  couponsTotal: number;
  giftCardsTotal?: number;
  customersTotal: number;
  storeCreditAvailable?: number;
  customersThisMonth?: number;
  productsActive?: number;
  ordersOnHold?: number;
  ordersCancelled?: number;
  ordersRefunded?: number;
  ordersPartiallyFilled?: number;
  salesThisYear?: number;
  dashboardTiles?: ApiDashboardTile[];
  warehouses: ApiWarehouseCard[];
  orders: ApiOrder[];
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

export type ApiCoupon = {
  id: string;
  code: string;
  name: string;
  discountType: string;
  amount: number;
  minimumAmount: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt?: string | null;
};

export type ApiBulkEmailDraft = {
  subject: string;
  title: string;
  bodyHtml: string;
  isSaved: boolean;
  savedAt: string | null;
};

export type ApiBulkEmailPreview = {
  count: number;
  sample: { email: string; name: string }[];
};

export type ApiBulkEmailBatch = {
  id: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  processed: number;
  lastRecipientEmail: string | null;
  status: string;
  subjectPreview: string | null;
  lastError: string | null;
  chunkSize: number;
  chunkGapMinutes: number;
  intervalSeconds: number;
  nextSendAt: string | null;
  canResume: boolean;
  canPause: boolean;
  canStop: boolean;
  hasRecipientTracking: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ApiBulkEmailRecipient = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  sortOrder: number;
};
