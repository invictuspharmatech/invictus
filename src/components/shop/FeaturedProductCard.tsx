import Link from "next/link";
import NextImage from "next/image";
import { formatMoney, mediaUrl, productPrice } from "@/lib/constants";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

type FeaturedProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  regularPrice: number;
  salePrice: number | null;
  image: string | null;
  warehouse: string;
  maxQuantityPerOrder: number | null;
  categories?: { category: { name: string } }[];
};

export function FeaturedProductCard({ product }: { product: FeaturedProduct }) {
  const src = mediaUrl(product.image);
  const category = product.categories?.[0]?.category.name;

  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-card">
        {src ? (
          <NextImage
            src={src}
            alt={product.name}
            fill
            className="object-contain p-8 transition duration-700 group-hover:scale-110"
            sizes="(min-width: 1024px) 25vw, 50vw"
            unoptimized
          />
        ) : null}
        {category ? (
          <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
            {category}
          </span>
        ) : null}
      </Link>
      <div className="flex items-start justify-between gap-3 pt-4">
        <div>
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-serif text-2xl transition group-hover:text-signal">{product.name}</h3>
          </Link>
          {product.shortDescription ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.shortDescription}</p>
          ) : null}
        </div>
        <AddToCartButton product={product} variant="icon" />
      </div>
      <p className="mt-3 font-mono text-sm text-muted-foreground">{formatMoney(productPrice(product))}</p>
    </article>
  );
}
