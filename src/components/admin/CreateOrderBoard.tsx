"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF_ORDER_STATUSES, formatOrderStatus } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import type { ApiProduct } from "@/lib/api-types";

type Line = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  shipping?: Record<string, string>;
};

type Preview = {
  merchandiseTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  couponCode?: string;
  error?: string;
};

const emptyShip = {
  name: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal: "",
  country: "US",
};

export function CreateOrderBoard() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ship, setShip] = useState(emptyShip);
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ApiProduct[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [shippingAmount, setShippingAmount] = useState("20");
  const [waiveShipping, setWaiveShipping] = useState(false);
  const [status, setStatus] = useState("PENDING");
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [paymentMethod, setPaymentMethod] = useState("btc");
  const [sendMail, setSendMail] = useState(true);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const payload = useMemo(
    () => ({
      userId: customer?.id,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      shipping: ship,
      couponCode,
      shippingAmount: waiveShipping ? 0 : Number(shippingAmount),
      waiveShipping,
      status,
      paymentStatus,
      paymentMethod,
      sendConfirmationEmail: sendMail,
      adminNote: notes,
    }),
    [
      couponCode,
      customer?.id,
      lines,
      notes,
      paymentMethod,
      paymentStatus,
      sendMail,
      ship,
      shippingAmount,
      status,
      waiveShipping,
    ],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setMatches([]);
        return;
      }
      void fetch(`/api/admin/orders/customers-search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((rows) => setMatches(Array.isArray(rows) ? rows : []));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (productQuery.trim().length < 2) {
        setProductHits([]);
        return;
      }
      void fetch(`/api/admin/products?q=${encodeURIComponent(productQuery)}`)
        .then((res) => res.json())
        .then((rows) => setProductHits(Array.isArray(rows) ? rows : []));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [productQuery]);

  useEffect(() => {
    if (lines.length === 0) {
      setPreview(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch("/api/admin/orders/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((row) => setPreview(row));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [payload, lines.length]);

  async function loadCustomer(row: Customer) {
    const response = await fetch(
      `/api/admin/orders/customer-lookup?q=${encodeURIComponent(row.email || row.id)}`,
    );
    const data = (await response.json()) as Customer & { error?: string };
    if (!response.ok) return;
    setCustomer(data);
    if (data.shipping) {
      const shipping = { ...data.shipping };
      delete shipping.phone;
      setShip({ ...emptyShip, ...shipping });
    } else {
      setShip({ ...emptyShip, name: data.name, email: data.email });
    }
    setQuery("");
    setMatches([]);
  }

  function addProduct(product: ApiProduct) {
    const price =
      product.salePrice != null && product.salePrice > 0 ? product.salePrice : product.regularPrice;
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { productId: product.id, name: product.name, quantity: 1, unitPrice: price }];
    });
    setProductQuery("");
    setProductHits([]);
  }

  async function createOrder() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/orders/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      error?: string;
      orders?: { id: string }[];
    };
    setBusy(false);
    if (!response.ok || !data.orders?.[0]) {
      setError(data.error || "Could not create order.");
      return;
    }
    router.push(`/admin/orders/${data.orders[0].id}`);
  }

  return (
    <div>
      <h1 className="display-font text-3xl">Create order</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Place an order for a customer. Gift cards and store credit are not used here.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tile space-y-3">
          <h2 className="text-lg">Customer</h2>
          <input
            className="field"
            placeholder="Search name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="divide-y divide-border/40 text-sm">
              {matches.map((row) => (
                <li key={row.id}>
                  <button type="button" className="w-full py-2 text-left" onClick={() => void loadCustomer(row)}>
                    {row.name} · {row.email}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {customer ? (
            <p className="text-sm text-muted-foreground">
              Selected {customer.name} ({customer.email})
            </p>
          ) : null}
          {Object.entries(ship).map(([key, value]) => (
            <label key={key} className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {key}
              <input
                className="field"
                value={value}
                onChange={(event) => setShip((current) => ({ ...current, [key]: event.target.value }))}
              />
            </label>
          ))}
        </section>

        <section className="tile space-y-3">
          <h2 className="text-lg">Items</h2>
          <input
            className="field"
            placeholder="Search products"
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
          />
          {productHits.length > 0 ? (
            <ul className="divide-y divide-border/40 text-sm">
              {productHits.slice(0, 8).map((product) => (
                <li key={product.id}>
                  <button type="button" className="w-full py-2 text-left" onClick={() => addProduct(product)}>
                    {product.name} · {formatMoney(product.salePrice || product.regularPrice)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {lines.map((line) => (
            <div key={line.productId} className="grid grid-cols-[1fr_80px_100px_auto] items-center gap-2 text-sm">
              <span>{line.name}</span>
              <input
                className="field"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row) =>
                      row.productId === line.productId
                        ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : row,
                    ),
                  )
                }
              />
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={line.unitPrice}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row) =>
                      row.productId === line.productId
                        ? { ...row, unitPrice: Number(event.target.value) || 0 }
                        : row,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="text-brand-red"
                onClick={() => setLines((current) => current.filter((row) => row.productId !== line.productId))}
              >
                Remove
              </button>
            </div>
          ))}
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Coupon
            <input className="field" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Shipping amount
            <input
              className="field"
              value={shippingAmount}
              onChange={(event) => setShippingAmount(event.target.value)}
              disabled={waiveShipping}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={waiveShipping}
              onChange={(event) => setWaiveShipping(event.target.checked)}
            />
            Waive shipping
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Status
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STAFF_ORDER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {formatOrderStatus(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Payment status
            <select
              className="field"
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
            >
              <option value="PENDING">pending</option>
              <option value="PAID">paid</option>
              <option value="PARTIAL">partial</option>
              <option value="FAILED">failed</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Payment method
            <select
              className="field"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="btc">Bitcoin</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendMail} onChange={(event) => setSendMail(event.target.checked)} />
            Send confirmation email
          </label>
          <textarea
            className="field min-h-20"
            placeholder="Admin note"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </section>
      </div>

      <div className="tile mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm">
          {preview?.error ? (
            <p className="text-brand-red">{preview.error}</p>
          ) : preview ? (
            <>
              <p>Merchandise {formatMoney(preview.merchandiseTotal)}</p>
              <p>Shipping {formatMoney(preview.shippingTotal)}</p>
              <p>Discount {formatMoney(preview.discountTotal)}</p>
              <p className="font-medium">Total {formatMoney(preview.grandTotal)}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Add items to preview totals.</p>
          )}
        </div>
        <button type="button" className="gold-btn" disabled={busy || lines.length === 0} onClick={() => void createOrder()}>
          {busy ? "Creating…" : "Create order"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
    </div>
  );
}
