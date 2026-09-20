import NextImage from "next/image";
import Link from "next/link";
import { formatMoney, mediaUrl, productPrice } from "@/lib/constants";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

type ProductCardProduct = {
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

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const src = mediaUrl(product.image);
  const price = productPrice(product);
  const category = product.categories?.[0]?.category.name;

  return (
    <article className="tile group flex h-full flex-col">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-muted">
          {src ? (
            <NextImage
              src={src}
              alt={product.name}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              sizes="(min-width: 1024px) 25vw, 50vw"
              unoptimized
            />
          ) : (
            <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
              No image
            </div>
          )}
        </div>
        {category ? (
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {category}
          </p>
        ) : null}
        <h3 className="mt-2 font-medium leading-snug">{product.name}</h3>
        {product.shortDescription ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {product.shortDescription}
          </p>
        ) : null}
        <p className="mt-3 text-sm">{formatMoney(price)}</p>
        {product.salePrice != null && product.salePrice < product.regularPrice ? (
          <p className="text-xs text-muted-foreground line-through">
            {formatMoney(product.regularPrice)}
          </p>
        ) : null}
      </Link>
      <div className="mt-auto pt-4">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}
