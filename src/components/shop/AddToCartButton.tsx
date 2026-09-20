"use client";

import { ShoppingCart } from "lucide-react";
import { productPrice } from "@/lib/constants";
import { useCart } from "@/components/shop/CartProvider";
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
};

export function AddToCartButton({
  product,
  variant = "button",
}: {
  product: Addable;
  variant?: "button" | "icon";
}) {
  const { addItem } = useCart();

  function add() {
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
