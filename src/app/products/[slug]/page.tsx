import { notFound } from "next/navigation";
import NextImage from "next/image";
import { djangoJsonOptional } from "@/lib/django";
import { formatMoney, mediaUrl, productPrice } from "@/lib/constants";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiProduct } from "@/lib/api-types";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await djangoJsonOptional<ApiProduct>(`/api/products/${slug}/`);
  if (!product) notFound();

  const src = mediaUrl(product.image);
  const price = productPrice(product);

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
        <div className="mt-8 max-w-sm">
          <AddToCartButton product={product} />
        </div>
        {product.maxQuantityPerOrder ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Limit {product.maxQuantityPerOrder} per order
          </p>
        ) : null}
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Fulfilled from {warehouseLabel(product.warehouse)}
        </p>
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
