import NextImage from "next/image";
import Link from "next/link";
import { formatMoney, mediaUrl, productPrice } from "@/lib/constants";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

export type StoreProductCardProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  regularPrice: number;
  salePrice: number | null;
  image: string | null;
  warehouse: string;
  maxQuantityPerOrder: number | null;
  stockStatus?: string;
  allowBackorder?: boolean;
  categories?: { category: { name: string } }[];
};

export function ProductCard({ product }: { product: StoreProductCardProduct }) {
  const src = mediaUrl(product.image);
  const price = productPrice(product);
  const category = product.categories?.[0]?.category.name;
  const onSale = product.salePrice != null && product.salePrice < product.regularPrice;
  const outOfStock = product.stockStatus === "outofstock";
  const onBackorder = product.stockStatus === "onbackorder" || product.stockStatus === "on_backorder";
  const canAdd = !outOfStock || Boolean(product.allowBackorder);

  return (
    <article className="store-card-product group">
      <Link href={`/products/${product.slug}`} className="flex flex-1 flex-col">
        <div className="store-card-media mb-5">
          {src ? (
            <NextImage
              src={src}
              alt={product.name}
              fill
              className="object-cover object-center transition duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 250px, (max-width: 1024px) 360px, 280px"
              unoptimized
            />
          ) : (
            <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
              No image
            </div>
          )}
        </div>
        {category ? (
          <span className="w-fit rounded-full bg-signal/20 px-2 py-1 text-xs font-medium uppercase tracking-wider text-signal">
            {category}
          </span>
        ) : null}
        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-base font-semibold transition-colors group-hover:text-signal">
          {product.name}
        </h3>
        {product.shortDescription ? (
          <p className="mt-1 line-clamp-3 text-sm leading-snug text-muted-foreground">
            {product.shortDescription}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-2">
          <span className="text-lg font-semibold text-signal">{formatMoney(price)}</span>
          {onSale ? (
            <span className="text-sm text-muted-foreground line-through">
              {formatMoney(product.regularPrice)}
            </span>
          ) : null}
        </div>
        {product.maxQuantityPerOrder ? (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-200/90">
            Limit {product.maxQuantityPerOrder} per order
          </p>
        ) : null}
        {onBackorder ? (
          <span className="mt-2 inline-flex w-fit items-center rounded-full border border-amber-400/45 bg-amber-950/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">
            On backorder
          </span>
        ) : null}
        {outOfStock && !product.allowBackorder ? (
          <span className="mt-1 text-xs text-red-300/90">Out of stock</span>
        ) : null}
      </Link>
      {canAdd ? (
        <div className="mt-auto pt-4">
          <AddToCartButton product={product} variant="card" />
        </div>
      ) : null}
    </article>
  );
}
