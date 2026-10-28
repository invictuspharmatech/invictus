import { notFound } from "next/navigation";
import NextImage from "next/image";
import { readSession } from "@/lib/auth";
import { djangoJsonOptional } from "@/lib/django";
import { formatMoney, mediaUrl, productPrice } from "@/lib/constants";
import { isOutOfStockNoBackorder } from "@/lib/stock";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { StockNotifyButton } from "@/components/shop/StockNotifyButton";
import type { ApiProduct } from "@/lib/api-types";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, session] = await Promise.all([
    djangoJsonOptional<ApiProduct>(`/api/products/${slug}/`),
    readSession(),
  ]);
  if (!product) notFound();

  const src = mediaUrl(product.image);
  const price = productPrice(product);
  const outOfStock = isOutOfStockNoBackorder({
    stockStatus: product.stockStatus,
    allowBackorder: product.allowBackorder,
    stockQuantity: product.stockQuantity,
  });

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
      <div className="relative aspect-[4/5] bg-muted">
        {src ? (
          <NextImage
            src={src}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {product.categories.map((row) => row.category.name).join(" · ")}
        </p>
        <h1 className="display-font mt-3 text-4xl">{product.name}</h1>
        <p className="mt-4 text-2xl">{formatMoney(price)}</p>
        {product.salePrice != null && product.salePrice < product.regularPrice ? (
          <p className="text-sm text-muted-foreground line-through">
            {formatMoney(product.regularPrice)}
          </p>
        ) : null}
        {product.shortDescription ? (
          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            {product.shortDescription}
          </p>
        ) : null}
        {outOfStock ? (
          <p className="mt-6 text-sm text-brand-red">Out of stock</p>
        ) : null}
        <div className="mt-8 max-w-sm">
          {outOfStock ? null : <AddToCartButton product={product} />}
        </div>
        <StockNotifyButton
          productId={product.id}
          outOfStock={outOfStock}
          initialEmail={session?.email || ""}
        />
        {product.maxQuantityPerOrder ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Limit {product.maxQuantityPerOrder} per order
          </p>
        ) : null}
        {product.description ? (
          <div className="mt-10 space-y-3 text-sm leading-7 text-muted-foreground">
            {product.description.split("\n").map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
