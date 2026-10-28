"use client";

import { ShoppingCart } from "lucide-react";
import { productPrice } from "@/lib/constants";
import { useCart } from "@/components/shop/CartProvider";
import { canPurchaseStock } from "@/lib/stock";
import { asWarehouse } from "@/lib/warehouse";

type Addable = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  regularPrice: number;
  salePrice: number | null;
  warehouse: string;
  maxQuantityPerOrder: number | null;
  stockStatus?: string | null;
  allowBackorder?: boolean | null;
  stockQuantity?: number | null;
};

export function AddToCartButton({
  product,
  variant = "button",
}: {
  product: Addable;
  variant?: "button" | "icon" | "card";
}) {
  const { addItem, items } = useCart();
  const inCartQty = items.find((row) => row.productId === product.id)?.quantity ?? 0;
  const nextQty = inCartQty + 1;
  const canAdd = canPurchaseStock({
    stockStatus: product.stockStatus,
    allowBackorder: product.allowBackorder,
    stockQuantity: product.stockQuantity,
    quantity: nextQty,
  });

  function add() {
    if (!canAdd) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      unitPrice: productPrice(product),
      warehouse: asWarehouse(product.warehouse),
      maxQuantityPerOrder: product.maxQuantityPerOrder,
    });
  }

  // Out of stock / not enough qty and no backorder — never show an add control.
  if (!canAdd) {
    return null;
  }

  switch (variant) {
    case "icon":
      return (
        <button
          type="button"
          aria-label={`Add ${product.name} to cart`}
          className="border border-border p-3 text-signal transition hover:bg-signal hover:text-primary-foreground"
          onClick={add}
        >
          <ShoppingCart className="size-4" />
        </button>
      );
    case "card":
      return (
        <button
          type="button"
          className="w-full rounded-[0.75rem] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] hover:bg-accent active:scale-95"
          onClick={add}
        >
          {inCartQty > 0 ? `In cart (${inCartQty}) — add` : "Add to cart"}
        </button>
      );
    case "button":
      return (
        <button type="button" className="gold-btn w-full" onClick={add}>
          Add
        </button>
      );
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}
