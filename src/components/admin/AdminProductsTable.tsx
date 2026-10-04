"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { ProductQuickEditPanel } from "@/components/admin/ProductQuickEditPanel";
import { formatMoney, mediaUrl } from "@/lib/constants";
import { warehouseLabel, warehouseShort } from "@/lib/warehouse";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

const PER_PAGE = 20;
const TABLE_COLUMNS = 12;

type SortBy = "name" | "sku" | "regularPrice" | "createdAt";
type SortOrder = "asc" | "desc";
type FeaturedFilter = "all" | "featured" | "not_featured";
type NewArrivalFilter = "all" | "yes" | "no";
type StockFilter = "" | "in_stock" | "out_of_stock" | "on_backorder";

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

export function AdminProductsTable({
  products,
  categories,
  admin,
}: {
  products: ApiProduct[];
  categories: ApiCategory[];
  admin: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("all");
  const [stockStatus, setStockStatus] = useState<StockFilter>("");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");
  const [newArrivalFilter, setNewArrivalFilter] = useState<NewArrivalFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setRows(products);
  }, [products]);

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
  }, [search, categoryId, status, stockStatus, featuredFilter, newArrivalFilter]);

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
    featuredFilter,
    newArrivalFilter,
    sortBy,
    sortOrder,
  ]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, lastPage);
  const pageRows = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filtersOn =
    Boolean(search || categoryId || stockStatus) ||
    status !== "all" ||
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

  async function moveWarehouse(product: ApiProduct) {
    if (!admin) return;
    setBusyId(`wh-${product.id}`);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/warehouse`, { method: "POST" });
      if (!res.ok) throw new Error("Could not move warehouse.");
      const data = (await res.json()) as { warehouse?: string };
      setRows((prev) =>
        prev.map((row) =>
          row.id === product.id ? { ...row, warehouse: data.warehouse || row.warehouse } : row,
        ),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not move warehouse.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProduct(product: ApiProduct) {
    if (!admin) return;
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setBusyId(`del-${product.id}`);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete product.");
      setRows((prev) => prev.filter((row) => row.id !== product.id));
      setSelectedIds((prev) => prev.filter((id) => id !== product.id));
      if (quickEditId === product.id) setQuickEditId(null);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete product.");
    } finally {
      setBusyId(null);
    }
  }

  async function applyBulk() {
    if (!admin || bulkAction !== "delete" || selectedIds.length === 0) {
      window.alert("Select products and a bulk action.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.length} product(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
          return res.ok ? id : null;
        }),
      );
      const removed = new Set(results.filter((id): id is string => Boolean(id)));
      setRows((prev) => prev.filter((row) => !removed.has(row.id)));
      setSelectedIds([]);
      setBulkAction("");
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setStatus("all");
    setStockStatus("");
    setFeaturedFilter("all");
    setNewArrivalFilter("all");
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="mt-6">
      <div className="tile mb-6 p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
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
            <div className="flex items-center gap-2">
              <select
                className="field max-w-48"
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
              >
                <option value="">Bulk actions</option>
                <option value="delete">Delete</option>
              </select>
              <button
                type="button"
                className="ghost-btn"
                disabled={bulkBusy || !bulkAction || selectedIds.length === 0}
                onClick={() => void applyBulk()}
              >
                Apply
              </button>
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
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {filtered.length} items • Page {currentPage} of {lastPage}
      </p>

      {filtered.length === 0 ? (
        <div className="tile p-8 text-center text-muted-foreground">No products found</div>
      ) : (
        <div className="overflow-hidden border border-border/50 bg-card/70">
          <div className="overflow-x-auto">
            <table className="min-w-[1600px] w-full text-left text-sm">
              <thead className="bg-card/80 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    {admin ? (
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={(event) => {
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
                  <th className="px-4 py-3">Image</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("name")}>
                    Name{sortMark("name")}
                  </th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("sku")}>
                    SKU{sortMark("sku")}
                  </th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Stock at location</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("regularPrice")}>
                    Price{sortMark("regularPrice")}
                  </th>
                  <th className="px-4 py-3">Categories</th>
                  <th className="px-4 py-3">New arrival</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("createdAt")}>
                    Date{sortMark("createdAt")}
                  </th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((product) => {
                  const open = quickEditId === product.id;
                  const src = mediaUrl(product.image);
                  const onSale =
                    product.salePrice != null && product.salePrice > 0 && product.salePrice < product.regularPrice;
                  return (
                    <Fragment key={product.id}>
                      <tr className={`border-t border-border/40 ${open ? "bg-signal/10" : "hover:bg-card/60"}`}>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
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
                        <td className="whitespace-nowrap px-4 py-3">{stockLabel(product)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {typeof product.stockQuantityW1 === "number" ? (
                              <span className="bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                                W1: {product.stockQuantityW1}
                              </span>
                            ) : null}
                            {typeof product.stockQuantityW2 === "number" ? (
                              <span className="bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                                W2: {product.stockQuantityW2}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs">Home: {warehouseLabel(product.warehouse)}</div>
                          {admin ? (
                            <button
                              type="button"
                              className="mt-1 text-[11px] uppercase tracking-[0.12em] text-signal hover:text-foreground"
                              disabled={busyId === `wh-${product.id}`}
                              onClick={() => void moveWarehouse(product)}
                            >
                              Move to {warehouseShort(product.warehouse === "WAREHOUSE_1" ? "WAREHOUSE_2" : "WAREHOUSE_1")}
                            </button>
                          ) : null}
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
                        <td className="px-4 py-3">
                          {admin ? (
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/admin/cms/products/${product.id}`}
                                title="Edit"
                                className="p-1.5 text-signal hover:bg-signal/15"
                              >
                                <Pencil className="size-4" />
                              </Link>
                              <button
                                type="button"
                                title="Quick edit: name, prices, quantity, backorder"
                                onClick={() =>
                                  setQuickEditId((id) => (id === product.id ? null : product.id))
                                }
                                className={`p-1.5 hover:bg-signal/15 ${
                                  open ? "bg-signal/20 text-signal" : "text-muted-foreground hover:text-signal"
                                }`}
                              >
                                <SlidersHorizontal className="size-4" />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                disabled={busyId === `del-${product.id}`}
                                onClick={() => void deleteProduct(product)}
                                className="p-1.5 text-red-400 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                      {admin && open ? (
                        <tr className="border-t border-border/30 bg-ink/50">
                          <td colSpan={TABLE_COLUMNS} className="p-0">
                            <ProductQuickEditPanel
                              product={product}
                              onCancel={() => setQuickEditId(null)}
                              onSaved={(updated) => {
                                replaceRow(updated);
                                setQuickEditId(null);
                                router.refresh();
                              }}
                            />
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
    </div>
  );
}
