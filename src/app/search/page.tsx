import { djangoJson } from "@/lib/django";
import { ProductCard } from "@/components/shop/ProductCard";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductsSearchForm } from "@/components/shop/SearchForm";
import type { ApiProduct } from "@/lib/api-types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const products = q
    ? await djangoJson<ApiProduct[]>(`/api/products/?q=${encodeURIComponent(q)}&limit=40`)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <PageHeader title="Search" lede="Find a product by name or SKU." />
      <ProductsSearchForm initial={q ?? ""} />
      {q ? (
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {products.length} results for “{q}”
        </p>
      ) : null}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
