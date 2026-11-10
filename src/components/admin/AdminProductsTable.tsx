"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { ProductQuickEditPanel } from "@/components/admin/ProductQuickEditPanel";
import { formatMoney, mediaUrl } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

const PER_PAGE = 20;
const TABLE_COLUMNS = 12;

type SortBy = "name" | "sku" | "regularPrice" | "createdAt";
type SortOrder = "asc" | "desc";
type FeaturedFilter = "all" | "featured" | "not_featured";
type NewArrivalFilter = "all" | "yes" | "no";
type StockFilter = "" | "in_stock" | "out_of_stock" | "on_backorder";
type WarehouseFilter = "" | "WAREHOUSE_1" | "WAREHOUSE_2";

function warehouseChipClass(active: boolean): string {
  if (active) {
    return "bg-emerald-700 px-2 py-0.5 font-mono text-xs text-emerald-50";
  }
  return "bg-muted px-2 py-0.5 font-mono text-xs text-foreground";
}

type InventoryDraft = {
  w1: string;
  w2: string;
  warehouse: string;
};

function draftFromProduct(product: ApiProduct): InventoryDraft {
  return {
    w1: String(product.stockQuantityW1 ?? 0),
    w2: String(product.stockQuantityW2 ?? 0),
    warehouse: product.warehouse,
  };
}

function parseStockInput(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function isInventoryDraftDirty(product: ApiProduct, draft: InventoryDraft): boolean {
  const w1Changed =
    typeof product.stockQuantityW1 === "number" &&
    parseStockInput(draft.w1) !== (product.stockQuantityW1 ?? 0);
  const w2Changed =
    typeof product.stockQuantityW2 === "number" &&
    parseStockInput(draft.w2) !== (product.stockQuantityW2 ?? 0);
  const warehouseChanged = draft.warehouse !== product.warehouse;
  return w1Changed || w2Changed || warehouseChanged;
}

function productWithDraft(product: ApiProduct, draft: InventoryDraft | undefined): ApiProduct {
  if (!draft) return product;
  return {
    ...product,
    warehouse: draft.warehouse || product.warehouse,
    stockQuantityW1:
      typeof product.stockQuantityW1 === "number" ? parseStockInput(draft.w1) : product.stockQuantityW1,
    stockQuantityW2:
      typeof product.stockQuantityW2 === "number" ? parseStockInput(draft.w2) : product.stockQuantityW2,
  };
}

function InventoryDraftEditor({
  product,
  draftOrBase,
  dirty,
  onChange,
  className,
  compact = false,
}: {
  product: ApiProduct;
  draftOrBase: InventoryDraft;
  dirty: boolean;
  onChange: (patch: Partial<InventoryDraft>) => void;
  className?: string;
  /** Mobile: assigned WH stock only + short WH1/WH2 labels. */
  compact?: boolean;
}) {
  const assignedIsW1 = draftOrBase.warehouse === "WAREHOUSE_1";
  const showW1 =
    typeof product.stockQuantityW1 === "number" && (!compact || assignedIsW1);
  const showW2 =
    typeof product.stockQuantityW2 === "number" && (!compact || !assignedIsW1);

  return (
    <div className={className}>
      <div className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`}>
        {showW1 ? (
          <label
            className={`inline-flex items-center ${warehouseChipClass(assignedIsW1)} ${
              compact ? "!gap-0.5 !px-1 !py-0 text-[10px]" : "gap-0.5"
            }`}
            title={assignedIsW1 ? "Assigned warehouse stock" : "Stock at Warehouse 1"}
          >
            W1
            <input
              className={`rounded border-0 bg-transparent font-mono text-inherit outline-none ring-1 ring-white/20 focus:ring-signal ${
                compact
                  ? "w-8 px-0 py-0 text-[10px]"
                  : "w-14 px-1 py-0.5 text-xs"
              }`}
              inputMode="numeric"
              value={draftOrBase.w1}
              onChange={(event) => onChange({ w1: event.target.value })}
            />
          </label>
        ) : null}
        {showW2 ? (
          <label
            className={`inline-flex items-center ${warehouseChipClass(!assignedIsW1)} ${
              compact ? "!gap-0.5 !px-1 !py-0 text-[10px]" : "gap-0.5"
            }`}
            title={!assignedIsW1 ? "Assigned warehouse stock" : "Stock at Warehouse 2"}
          >
            W2
            <input
              className={`rounded border-0 bg-transparent font-mono text-inherit outline-none ring-1 ring-white/20 focus:ring-signal ${
                compact
                  ? "w-8 px-0 py-0 text-[10px]"
                  : "w-14 px-1 py-0.5 text-xs"
              }`}
              inputMode="numeric"
              value={draftOrBase.w2}
              onChange={(event) => onChange({ w2: event.target.value })}
            />
          </label>
        ) : null}
      </div>
      {compact ? (
        <select
          className="field mt-1 !w-auto !min-w-0 !px-1 !py-0 text-[10px]"
          value={draftOrBase.warehouse}
          title="Home warehouse"
          aria-label="Home warehouse"
          onChange={(event) => onChange({ warehouse: event.target.value })}
        >
          <option value="WAREHOUSE_1">WH1</option>
          <option value="WAREHOUSE_2">WH2</option>
        </select>
      ) : (
        <label className="mt-1.5 grid gap-1 text-[11px]">
          Home WH
          <select
            className="field !py-1.5 text-xs"
            value={draftOrBase.warehouse}
            onChange={(event) => onChange({ warehouse: event.target.value })}
          >
            <option value="WAREHOUSE_1">Warehouse 1</option>
            <option value="WAREHOUSE_2">Warehouse 2</option>
          </select>
        </label>
      )}
      {dirty ? (
        <p className={`text-amber-300 ${compact ? "mt-0.5 text-[10px]" : "mt-1 text-[11px]"}`}>
          {compact ? "Draft" : "Draft — not saved yet"}
        </p>
      ) : null}
    </div>
  );
}

function compareProducts(a: ApiProduct, b: ApiProduct, sortBy: SortBy, sortOrder: SortOrder): number {
  let result = 0;
  switch (sortBy) {
    case "name":
      result = a.name.localeCompare(b.name);
      break;
    case "sku":
      result = (a.sku || "").localeCompare(b.sku || "");
      break;
    case "regularPrice":
      result = (a.regularPrice || 0) - (b.regularPrice || 0);
      break;
    case "createdAt":
      result = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      break;
    default: {
      const exhaustive: never = sortBy;
      return exhaustive;
    }
  }
  return sortOrder === "asc" ? result : -result;
}

function productTotal(product: ApiProduct): number {
  if (typeof product.stockQuantity === "number") return product.stockQuantity;
  return (product.stockQuantityW1 ?? 0) + (product.stockQuantityW2 ?? 0);
}

function stockKey(product: ApiProduct): StockFilter {
  const total = productTotal(product);
  if (total > 0) return "in_stock";
  if (product.allowBackorder) return "on_backorder";
  return "out_of_stock";
}

function stockLabel(product: ApiProduct): string {
  const total = productTotal(product);
  const key = stockKey(product);
  switch (key) {
    case "in_stock":
      return `In stock (${total})`;
    case "out_of_stock":
      return `Out of stock (${total})`;
    case "on_backorder":
      return `On backorder (${total})`;
    case "":
      return `${total}`;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function formatListDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function statusLabel(status: string): string {
  if (status === "publish") return "Active";
  if (status === "draft" || status === "inactive") return "Inactive";
  return status || "—";
}

async function patchProduct(id: string, payload: Record<string, unknown>): Promise<ApiProduct> {
  const res = await fetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ApiProduct & { error?: string };
  if (!res.ok) throw new Error(data.error || "Could not save product.");
  return data;
}

type BulkAction =
  | ""
  | "set_active"
  | "set_inactive"
  | "set_categories"
  | "sale_percent"
  | "sale_flat"
  | "clear_sale"
  | "set_warehouse"
  | "allow_backorder"
  | "disallow_backorder"
  | "delete";

export function AdminProductsTable({
  products,
  categories,
  admin,
  enableWarehouseBulk = true,
}: {
  products: ApiProduct[];
  categories: ApiCategory[];
  admin: boolean;
  /** Dual-warehouse catalog controls (Invictus). */
  enableWarehouseBulk?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkPercent, setBulkPercent] = useState("10");
  const [bulkFlat, setBulkFlat] = useState("50");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkWarehouse, setBulkWarehouse] = useState("WAREHOUSE_1");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("active");
  const [stockStatus, setStockStatus] = useState<StockFilter>("");
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseFilter>("");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");
  const [newArrivalFilter, setNewArrivalFilter] = useState<NewArrivalFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, InventoryDraft>>({});
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState("");

  useEffect(() => {
    setRows(products);
  }, [products]);

  const dirtyInventory = useMemo(() => {
    const items: { product: ApiProduct; draft: InventoryDraft }[] = [];
    for (const product of rows) {
      const draft = inventoryDrafts[product.id];
      if (draft && isInventoryDraftDirty(product, draft)) {
        items.push({ product, draft });
      }
    }
    return items;
  }, [rows, inventoryDrafts]);

  useEffect(() => {
    if (dirtyInventory.length === 0) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyInventory.length]);

  useEffect(() => {
    if (quickEditId == null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setQuickEditId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickEditId]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [search, categoryId, status, stockStatus, warehouseFilter, featuredFilter, newArrivalFilter]);

  const statusCounts = useMemo(() => {
    const all = rows.length;
    const active = rows.filter((row) => row.status === "publish").length;
    return { all, active, inactive: all - active };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((product) => {
        if (query && !`${product.name} ${product.sku}`.toLowerCase().includes(query)) return false;
        if (categoryId && !product.categories.some((row) => row.category.id === categoryId)) return false;
        if (status === "active" && product.status !== "publish") return false;
        if (status === "inactive" && product.status === "publish") return false;
        if (stockStatus && stockKey(product) !== stockStatus) return false;
        if (warehouseFilter && product.warehouse !== warehouseFilter) return false;
        if (featuredFilter === "featured" && !product.isFeatured) return false;
        if (featuredFilter === "not_featured" && product.isFeatured) return false;
        if (newArrivalFilter === "yes" && !product.isNewArrival) return false;
        if (newArrivalFilter === "no" && product.isNewArrival) return false;
        return true;
      })
      .sort((a, b) => compareProducts(a, b, sortBy, sortOrder));
  }, [
    rows,
    search,
    categoryId,
    status,
    stockStatus,
    warehouseFilter,
    featuredFilter,
    newArrivalFilter,
    sortBy,
    sortOrder,
  ]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, lastPage);
  const pageRows = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filtersOn =
    Boolean(search || categoryId || stockStatus || warehouseFilter) ||
    status !== "active" ||
    featuredFilter !== "all" ||
    newArrivalFilter !== "all";

  function toggleSort(next: SortBy) {
    if (sortBy === next) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(next);
    setSortOrder("asc");
  }

  function sortMark(column: SortBy): string {
    if (sortBy !== column) return "";
    return sortOrder === "asc" ? " ↑" : " ↓";
  }

  function replaceRow(updated: ApiProduct) {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    setInventoryDrafts((prev) => {
      if (!prev[updated.id]) return prev;
      const { [updated.id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  }

  async function toggleFlag(product: ApiProduct, field: "isFeatured" | "isNewArrival") {
    if (!admin) return;
    setBusyId(`${field}-${product.id}`);
    try {
      const updated = await patchProduct(product.id, { [field]: !product[field] });
      replaceRow(updated);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update product.");
    } finally {
      setBusyId(null);
    }
  }

  function setInventoryDraft(
    product: ApiProduct,
    patch: Partial<InventoryDraft>,
  ) {
    setInventoryDrafts((prev) => {
      const current = prev[product.id] ?? draftFromProduct(product);
      const next = { ...current, ...patch };
      if (!isInventoryDraftDirty(product, next)) {
        const { [product.id]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [product.id]: next };
    });
    setInventoryError("");
  }

  function discardInventoryDrafts() {
    if (dirtyInventory.length === 0) return;
    if (
      !window.confirm(
        `Discard ${dirtyInventory.length} unsaved inventory change${dirtyInventory.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }
    setInventoryDrafts({});
    setInventoryError("");
  }

  async function saveInventoryDrafts() {
    if (!admin || dirtyInventory.length === 0) return;
    setInventoryBusy(true);
    setInventoryError("");
    try {
      const updates = dirtyInventory.map(({ product, draft }) => {
        const row: Record<string, unknown> = { id: product.id };
        if (draft.warehouse !== product.warehouse) {
          row.warehouse = draft.warehouse;
        }
        if (
          typeof product.stockQuantityW1 === "number" &&
          parseStockInput(draft.w1) !== (product.stockQuantityW1 ?? 0)
        ) {
          row.stockQuantityW1 = parseStockInput(draft.w1);
        }
        if (
          typeof product.stockQuantityW2 === "number" &&
          parseStockInput(draft.w2) !== (product.stockQuantityW2 ?? 0)
        ) {
          row.stockQuantityW2 = parseStockInput(draft.w2);
        }
        return row;
      });
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_inventory",
          ids: updates.map((row) => row.id),
          updates,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        products?: ApiProduct[];
        errors?: string[];
      };
      if (!res.ok) {
        setInventoryError(data.error || "Could not update inventory.");
        return;
      }
      if (Array.isArray(data.products)) {
        const byId = new Map(data.products.map((product) => [product.id, product]));
        setRows((prev) =>
          prev.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id)! } : row)),
        );
      }
      setInventoryDrafts((prev) => {
        const next = { ...prev };
        for (const { product } of dirtyInventory) {
          delete next[product.id];
        }
        return next;
      });
      if (data.errors?.length) {
        setInventoryError(data.errors.join(" "));
      }
    } catch {
      setInventoryError("Could not update inventory.");
    } finally {
      setInventoryBusy(false);
    }
  }

  async function toggleProductStatus(product: ApiProduct) {
    if (!admin) return;
    const nextStatus = product.status === "publish" ? "draft" : "publish";
    setBusyId(`status-${product.id}`);
    try {
      const updated = await patchProduct(product.id, { status: nextStatus });
      replaceRow(updated);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update status.");
    } finally {
      setBusyId(null);
    }
  }

  function buildBulkPayload(): Record<string, unknown> | null {
    const ids = selectedIds;
    switch (bulkAction) {
      case "set_active":
        return { ids, action: "set_status", status: "publish" };
      case "set_inactive":
        return { ids, action: "set_status", status: "draft" };
      case "set_categories":
        if (!bulkCategoryId) {
          setBulkError("Choose a category.");
          return null;
        }
        return { ids, action: "set_categories", categoryIds: [bulkCategoryId] };
      case "sale_percent": {
        const percent = Number(bulkPercent);
        if (Number.isNaN(percent) || percent < 0 || percent > 100) {
          setBulkError("Enter a percent between 0 and 100.");
          return null;
        }
        return { ids, action: "sale_percent", percent };
      }
      case "sale_flat": {
        const amount = Number(bulkFlat);
        if (Number.isNaN(amount) || amount < 0) {
          setBulkError("Enter a valid dollar amount.");
          return null;
        }
        return { ids, action: "sale_flat", amount };
      }
      case "clear_sale":
        return { ids, action: "clear_sale" };
      case "set_warehouse":
        if (!enableWarehouseBulk) {
          setBulkError("Warehouse bulk edit is not enabled.");
          return null;
        }
        return { ids, action: "set_warehouse", warehouse: bulkWarehouse };
      case "allow_backorder":
        return { ids, action: "set_backorder", allowBackorder: true };
      case "disallow_backorder":
        return { ids, action: "set_backorder", allowBackorder: false };
      case "delete":
        return { ids, action: "delete" };
      default:
        setBulkError("Choose a bulk action.");
        return null;
    }
  }

  async function applyBulk() {
    if (!admin || selectedIds.length === 0 || !bulkAction) {
      setBulkError("Select products and a bulk action.");
      return;
    }
    setBulkError("");
    const payload = buildBulkPayload();
    if (!payload) return;

    if (bulkAction === "delete") {
      if (!window.confirm(`Delete ${selectedIds.length} product(s)? This cannot be undone.`)) return;
    } else {
      const label =
        bulkAction === "sale_percent"
          ? `${bulkPercent}% off`
          : bulkAction === "sale_flat"
            ? `$${bulkFlat} off`
            : bulkAction === "allow_backorder"
              ? "Allow backorder"
              : bulkAction === "disallow_backorder"
                ? "Disallow backorder"
                : bulkAction.replace(/_/g, " ");
      if (!window.confirm(`Apply “${label}” to ${selectedIds.length} product(s)?`)) return;
    }

    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        products?: ApiProduct[];
        deleted?: number;
        updated?: number;
      };
      if (!res.ok) {
        setBulkError(data.error || "Bulk update failed.");
        return;
      }

      if (bulkAction === "delete") {
        const removed = new Set(selectedIds);
        setRows((prev) => prev.filter((row) => !removed.has(row.id)));
        if (quickEditId && removed.has(quickEditId)) setQuickEditId(null);
      } else if (Array.isArray(data.products)) {
        const byId = new Map(data.products.map((product) => [product.id, product]));
        setRows((prev) => prev.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id)! } : row)));
      }

      setSelectedIds([]);
      setBulkAction("");
      router.refresh();
    } catch {
      setBulkError("Bulk update failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setStatus("active");
    setStockStatus("");
    setWarehouseFilter("");
    setFeaturedFilter("all");
    setNewArrivalFilter("all");
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));
  const someSelected = selectedIds.length > 0;

  return (
    <div className={`mt-6 ${dirtyInventory.length > 0 ? "pb-28" : ""}`}>
      <div className="tile mb-6 p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <select
            className="field"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select className="field" value="simple" disabled>
            <option value="simple">Simple</option>
          </select>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All status ({statusCounts.all})</option>
            <option value="active">Active ({statusCounts.active})</option>
            <option value="inactive">Inactive ({statusCounts.inactive})</option>
          </select>
          <select
            className="field"
            value={stockStatus}
            onChange={(event) => setStockStatus(event.target.value as StockFilter)}
          >
            <option value="">Filter by stock status</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="on_backorder">On backorder</option>
          </select>
          <select
            className="field"
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value as WarehouseFilter)}
          >
            <option value="">Warehouse: all</option>
            <option value="WAREHOUSE_1">Assigned to WH1</option>
            <option value="WAREHOUSE_2">Assigned to WH2</option>
          </select>
          <select
            className="field"
            value={featuredFilter}
            onChange={(event) => setFeaturedFilter(event.target.value as FeaturedFilter)}
          >
            <option value="all">Featured: all</option>
            <option value="featured">Featured only ★</option>
            <option value="not_featured">Not featured</option>
          </select>
          <select
            className="field"
            value={newArrivalFilter}
            onChange={(event) => setNewArrivalFilter(event.target.value as NewArrivalFilter)}
          >
            <option value="all">New arrival: all</option>
            <option value="yes">New arrival on home ◆</option>
            <option value="no">Not in New arrivals</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {admin ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="field max-w-56"
                value={bulkAction}
                onChange={(event) => {
                  setBulkAction(event.target.value as BulkAction);
                  setBulkError("");
                }}
              >
                <option value="">Bulk actions</option>
                <option value="set_active">Set active</option>
                <option value="set_inactive">Set inactive</option>
                <option value="set_categories">Set category</option>
                <option value="sale_percent">Sale: % off</option>
                <option value="sale_flat">Sale: $ off</option>
                <option value="clear_sale">Clear sale prices</option>
                {enableWarehouseBulk ? (
                  <option value="set_warehouse">Move to warehouse</option>
                ) : null}
                <option value="allow_backorder">Allow backorder</option>
                <option value="disallow_backorder">Disallow backorder</option>
                <option value="delete">Delete</option>
              </select>
              {bulkAction === "set_categories" ? (
                <select
                  className="field max-w-48"
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {bulkAction === "sale_percent" ? (
                <label className="flex items-center gap-1 text-sm text-muted-foreground">
                  <input
                    className="field w-20"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={bulkPercent}
                    onChange={(event) => setBulkPercent(event.target.value)}
                  />
                  % off
                </label>
              ) : null}
              {bulkAction === "sale_flat" ? (
                <label className="flex items-center gap-1 text-sm text-muted-foreground">
                  $
                  <input
                    className="field w-24"
                    type="number"
                    min={0}
                    step={0.01}
                    value={bulkFlat}
                    onChange={(event) => setBulkFlat(event.target.value)}
                  />
                  off
                </label>
              ) : null}
              {bulkAction === "set_warehouse" && enableWarehouseBulk ? (
                <select
                  className="field max-w-44"
                  value={bulkWarehouse}
                  onChange={(event) => setBulkWarehouse(event.target.value)}
                >
                  <option value="WAREHOUSE_1">Warehouse 1</option>
                  <option value="WAREHOUSE_2">Warehouse 2</option>
                </select>
              ) : null}
              <button
                type="button"
                className="ghost-btn"
                disabled={bulkBusy || filtered.length === 0 || allFilteredSelected}
                onClick={() => setSelectedIds(filtered.map((row) => row.id))}
                title={
                  filtersOn
                    ? `Select every product matching the current filters (${filtered.length})`
                    : `Select every product (${filtered.length})`
                }
              >
                Select all ({filtered.length})
              </button>
              {someSelected ? (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={bulkBusy}
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-btn"
                disabled={bulkBusy || !bulkAction || selectedIds.length === 0}
                onClick={() => void applyBulk()}
              >
                {bulkBusy ? "Applying…" : "Apply"}
              </button>
              {someSelected ? (
                <span className="text-sm text-muted-foreground">
                  {allFilteredSelected
                    ? `All ${selectedIds.length} selected`
                    : `${selectedIds.length} selected`}
                </span>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field max-w-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
            />
            {filtersOn ? (
              <button type="button" className="ghost-btn" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
        {admin && bulkError ? <p className="mt-3 text-sm text-brand-red">{bulkError}</p> : null}
        {admin && allOnPageSelected && !allFilteredSelected && filtered.length > pageRows.length ? (
          <div className="mt-3 rounded border border-signal/40 bg-signal/10 px-3 py-2 text-sm">
            All {pageRows.length} products on this page are selected.{" "}
            <button
              type="button"
              className="font-medium text-signal underline-offset-2 hover:underline"
              onClick={() => setSelectedIds(filtered.map((row) => row.id))}
            >
              Select all {filtered.length} products
            </button>{" "}
            across every page instead.
          </div>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {filtered.length} items • Page {currentPage} of {lastPage}
        {someSelected ? ` • ${selectedIds.length} selected` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="tile p-8 text-center text-muted-foreground">No products found</div>
      ) : (
        <div className="overflow-hidden border border-border/50 bg-card/70">
          <div className="overflow-x-auto">
            <table className="min-w-[1600px] w-full text-left text-sm">
              <thead className="bg-card/80 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-20 w-12 bg-card px-3 py-3">
                    {admin ? (
                      <input
                        type="checkbox"
                        title={
                          allFilteredSelected
                            ? "Clear selection"
                            : "Select this page (use Select all for every product)"
                        }
                        checked={allOnPageSelected || allFilteredSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              someSelected && !allOnPageSelected && !allFilteredSelected;
                          }
                        }}
                        onChange={(event) => {
                          if (allFilteredSelected) {
                            setSelectedIds([]);
                            return;
                          }
                          if (event.target.checked) {
                            setSelectedIds((prev) => [
                              ...new Set([...prev, ...pageRows.map((row) => row.id)]),
                            ]);
                          } else {
                            const hide = new Set(pageRows.map((row) => row.id));
                            setSelectedIds((prev) => prev.filter((id) => !hide.has(id)));
                          }
                        }}
                      />
                    ) : null}
                  </th>
                  <th className="sticky left-12 z-20 w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] bg-card px-1 py-3 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.8)] md:w-auto md:min-w-[7.5rem] md:max-w-none md:px-3">
                    Actions
                  </th>
                  <th className="hidden px-4 py-3 md:table-cell">Image</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("name")}>
                    Name{sortMark("name")}
                  </th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("sku")}>
                    SKU{sortMark("sku")}
                  </th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="hidden px-4 py-3 md:table-cell">Stock at location</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("regularPrice")}>
                    Price{sortMark("regularPrice")}
                  </th>
                  <th className="px-4 py-3">Categories</th>
                  <th className="px-4 py-3">New arrival</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("createdAt")}>
                    Date{sortMark("createdAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((product) => {
                  const open = quickEditId === product.id;
                  const draft = inventoryDrafts[product.id];
                  const dirty = Boolean(draft && isInventoryDraftDirty(product, draft));
                  const view = productWithDraft(product, draft);
                  const draftOrBase = draft ?? draftFromProduct(product);
                  const src = mediaUrl(product.image);
                  const onSale =
                    product.salePrice != null && product.salePrice > 0 && product.salePrice < product.regularPrice;
                  return (
                    <Fragment key={product.id}>
                      <tr
                        className={`border-t border-border/40 ${
                          open
                            ? "bg-signal/10"
                            : dirty
                              ? "bg-amber-950/30"
                              : "hover:bg-card/60"
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-20 w-12 px-3 py-3 ${
                            open ? "bg-[#241410]" : dirty ? "bg-amber-950/40" : "bg-card"
                          }`}
                        >
                          {admin ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(product.id)}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedIds((prev) => [...prev, product.id]);
                                } else {
                                  setSelectedIds((prev) => prev.filter((id) => id !== product.id));
                                }
                              }}
                            />
                          ) : null}
                        </td>
                        <td
                          className={`sticky left-12 z-20 w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] px-1 py-2 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.8)] md:w-auto md:min-w-[7.5rem] md:max-w-none md:px-3 md:py-3 ${
                            open ? "bg-[#241410]" : dirty ? "bg-amber-950/40" : "bg-card"
                          }`}
                        >
                          {admin ? (
                            <div className="space-y-1 md:space-y-2">
                              <div className="flex items-center gap-0.5 md:gap-1">
                                <Link
                                  href={`/admin/cms/products/${product.id}`}
                                  title="Edit"
                                  className="p-1.5 text-signal hover:bg-signal/15"
                                >
                                  <Pencil className="size-4" />
                                </Link>
                                <button
                                  type="button"
                                  title="Quick edit: name, image, prices, quantity, backorder"
                                  onClick={() =>
                                    setQuickEditId((id) => (id === product.id ? null : product.id))
                                  }
                                  className={`p-1.5 hover:bg-signal/15 ${
                                    open
                                      ? "bg-signal/20 text-signal"
                                      : "text-muted-foreground hover:text-signal"
                                  }`}
                                >
                                  <SlidersHorizontal className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  title={
                                    product.status === "publish"
                                      ? "Active — click to set inactive"
                                      : "Inactive — click to set active"
                                  }
                                  disabled={busyId === `status-${product.id}`}
                                  onClick={() => void toggleProductStatus(product)}
                                  className={`hidden p-1.5 disabled:opacity-50 md:inline-flex ${
                                    product.status === "publish"
                                      ? "text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                                      : "text-red-400 hover:bg-red-950/50 hover:text-red-300"
                                  }`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                              {enableWarehouseBulk ? (
                                <InventoryDraftEditor
                                  product={product}
                                  draftOrBase={draftOrBase}
                                  dirty={dirty}
                                  compact
                                  className="md:hidden"
                                  onChange={(patch) => setInventoryDraft(product, patch)}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          {src ? (
                            <img
                              src={src}
                              alt=""
                              className="size-12 object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                event.currentTarget.nextElementSibling?.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div
                            className={`grid size-12 place-items-center bg-muted text-xs text-muted-foreground ${src ? "hidden" : ""}`}
                          >
                            📦
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/cms/products/${product.id}`}
                            className="font-medium text-signal hover:text-foreground"
                          >
                            {product.name}
                          </Link>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{statusLabel(product.status)}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{product.sku || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3">{stockLabel(view)}</td>
                        <td className="hidden px-4 py-3 align-top text-muted-foreground md:table-cell">
                          {admin && enableWarehouseBulk ? (
                            <InventoryDraftEditor
                              product={product}
                              draftOrBase={draftOrBase}
                              dirty={dirty}
                              className="space-y-2"
                              onChange={(patch) => setInventoryDraft(product, patch)}
                            />
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-1">
                                {typeof product.stockQuantityW1 === "number" ? (
                                  <span
                                    className={warehouseChipClass(
                                      product.warehouse === "WAREHOUSE_1",
                                    )}
                                  >
                                    W1: {product.stockQuantityW1}
                                  </span>
                                ) : null}
                                {typeof product.stockQuantityW2 === "number" ? (
                                  <span
                                    className={warehouseChipClass(
                                      product.warehouse === "WAREHOUSE_2",
                                    )}
                                  >
                                    W2: {product.stockQuantityW2}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs">
                                Home:{" "}
                                <span className="font-medium text-emerald-400">
                                  {warehouseLabel(product.warehouse)}
                                </span>
                              </div>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">
                          {onSale ? (
                            <span>
                              <span className="text-signal">{formatMoney(product.salePrice ?? 0)}</span>
                              <span className="ml-2 text-muted-foreground line-through">
                                {formatMoney(product.regularPrice)}
                              </span>
                            </span>
                          ) : (
                            formatMoney(product.regularPrice)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {product.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {product.categories.map((row) => (
                                <span key={row.category.id} className="bg-muted px-2 py-0.5 text-xs">
                                  {row.category.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Uncategorized</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            title={product.isNewArrival ? "Remove from home New arrivals" : "Show on home New arrivals"}
                            disabled={!admin || busyId === `isNewArrival-${product.id}`}
                            onClick={() => void toggleFlag(product, "isNewArrival")}
                            className="text-lg leading-none disabled:opacity-50"
                          >
                            {product.isNewArrival ? (
                              <span className="text-sky-400">◆</span>
                            ) : (
                              <span className="text-muted-foreground/50 hover:text-sky-400">◇</span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            title={product.isFeatured ? "Remove from featured" : "Mark as featured"}
                            disabled={!admin || busyId === `isFeatured-${product.id}`}
                            onClick={() => void toggleFlag(product, "isFeatured")}
                            className="text-lg leading-none disabled:opacity-50"
                          >
                            {product.isFeatured ? (
                              <span className="text-signal">★</span>
                            ) : (
                              <span className="text-muted-foreground/50 hover:text-signal">☆</span>
                            )}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatListDate(product.createdAt)}
                        </td>
                      </tr>
                      {admin && open ? (
                        <tr className="border-t border-border/30 bg-ink/50">
                          <td colSpan={TABLE_COLUMNS} className="p-0">
                            <div className="sticky left-0 max-w-[min(48rem,calc(100vw-2rem))]">
                              <ProductQuickEditPanel
                                product={product}
                                onCancel={() => setQuickEditId(null)}
                                onSaved={(updated) => {
                                  replaceRow(updated);
                                  setQuickEditId(null);
                                  router.refresh();
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lastPage > 1 ? (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <button className="ghost-btn" type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>
                  {"<<"}
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {"<"}
                </button>
                <span>
                  Page {currentPage} of {lastPage}
                </span>
                <button
                  className="ghost-btn"
                  type="button"
                  disabled={currentPage >= lastPage}
                  onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
                >
                  {">"}
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  disabled={currentPage >= lastPage}
                  onClick={() => setPage(lastPage)}
                >
                  {">>"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {admin && dirtyInventory.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-card/95 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur sm:px-4 sm:py-3">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {dirtyInventory.length} draft
                {dirtyInventory.length === 1 ? "" : "s"} ready
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Search and edit freely — changes stay until you update all or discard.
              </p>
              {inventoryError ? (
                <p className="mt-1 text-sm text-brand-red">{inventoryError}</p>
              ) : null}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                className="ghost-btn flex-1 !px-3 !py-2 sm:flex-none"
                disabled={inventoryBusy}
                onClick={discardInventoryDrafts}
              >
                Discard
              </button>
              <button
                type="button"
                className="gold-btn flex-1 !px-3 !py-2 sm:flex-none"
                disabled={inventoryBusy}
                onClick={() => void saveInventoryDrafts()}
              >
                {inventoryBusy ? "Updating…" : `Update all (${dirtyInventory.length})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
