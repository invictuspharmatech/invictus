import { djangoJson } from "@/lib/django";
import { ProductCard } from "@/components/shop/ProductCard";
import { PageHeader } from "@/components/site/PageHeader";
import Link from "next/link";
import { CATEGORY_BLURBS } from "@/lib/constants";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const query = params.toString();

  const [categories, products] = await Promise.all([
    djangoJson<ApiCategory[]>("/api/categories/"),
    djangoJson<ApiProduct[]>(`/api/products/${query ? `?${query}` : ""}`),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Our Products"
        lede="Explore considered formulas selected for clarity, consistency, and performance."
      />
      <div className="mb-8 flex flex-wrap gap-2">
        <FilterChip href="/products" active={!category} label="All" />
        {categories
          .filter((item) => item.slug !== "uncategorized" && item.slug !== "on-sale")
          .map((item) => (
            <FilterChip
              key={item.id}
              href={`/products?category=${item.slug}`}
              active={category === item.slug}
              label={item.name}
            />
          ))}
      </div>
      {category && CATEGORY_BLURBS[category] ? (
        <p className="mb-8 text-sm text-muted-foreground">{CATEGORY_BLURBS[category]}</p>
      ) : null}
      <p className="mb-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {products.length} products
      </p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${
        active ? "bg-primary text-primary-foreground" : "hairline text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
