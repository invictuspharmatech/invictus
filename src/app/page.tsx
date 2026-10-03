import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { djangoJsonSafe } from "@/lib/django";
import { FeaturedProductCard } from "@/components/shop/FeaturedProductCard";
import { CategoryCarousel, type CategorySlide } from "@/components/shop/CategoryCarousel";
import {
  CATEGORY_BLURBS,
  CATEGORY_IMAGES,
  HOME_PROTOCOL_SLUGS,
  mediaUrl,
} from "@/lib/constants";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

const MARQUEE = [
  "Precision / Purpose / Progress",
  "Evidence over excess",
  "Built for the long game",
];

function toSlides(categories: ApiCategory[]): CategorySlide[] {
  const bySlug = new Map(categories.map((item) => [item.slug, item]));
  const peptides = bySlug.get("peptides");
  if (peptides && !bySlug.has("peptides-glps")) {
    bySlug.set("peptides-glps", peptides);
  }
  return HOME_PROTOCOL_SLUGS.flatMap((slug) => {
    const item = bySlug.get(slug);
    if (!item) return [];
    return [
      {
        id: item.id,
        slug: item.slug,
        name: item.name,
        image:
          mediaUrl(item.image) ??
          CATEGORY_IMAGES[item.slug] ??
          "/images/featured-display.jpg",
        blurb: CATEGORY_BLURBS[item.slug] ?? "Browse the collection.",
      },
    ];
  });
}

export default async function HomePage() {
  const [categories, featured, arrivals] = await Promise.all([
    djangoJsonSafe<ApiCategory[]>("/api/categories/", []),
    djangoJsonSafe<ApiProduct[]>("/api/products/?featured=1&limit=4", []),
    djangoJsonSafe<ApiProduct[]>("/api/products/?newArrival=1&limit=4", []),
  ]);

  const slides = toSlides(categories);
  const featuredSlots = featured.slice(0, 4);
  const arrivalSlots = arrivals.slice(0, 4);

  return (
    <div>
      <section className="relative mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-16">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-red/25 blur-3xl" />
        <div className="relative flex flex-col justify-center">
          <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
            <Image
              src="/images/invictus-logo.png"
              alt="Invictus Pharma"
              width={220}
              height={220}
              className="h-64 w-64 shrink-0 object-contain sm:h-80 sm:w-80"
              priority
            />
            <h1 className="max-w-3xl font-serif text-3xl leading-[0.95] tracking-[-0.04em] text-balance sm:text-4xl lg:text-[3.6rem]">
              The standard is <em className="brand-text-gradient not-italic">higher.</em>
            </h1>
          </div>
          <p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            Invictus is a considered collection of performance and wellness essentials,
            selected with the discipline of a laboratory and the eye of an artist.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/products"
              className="group brand-gradient inline-flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-paper transition hover:-translate-y-1"
            >
              Shop now
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
            <Link
              href="/test-results"
              className="inline-flex items-center gap-2 border-b border-border px-1 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground transition hover:border-signal hover:text-signal"
            >
              View test results
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="relative min-h-[480px] overflow-hidden bg-ink sm:min-h-[620px]">
          <Image
            src="/images/featured-display.jpg"
            alt="Invictus product display"
            fill
            className="object-cover opacity-90 mix-blend-screen"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-brand-red-deep/30 to-signal/25" />
          <div className="absolute left-6 top-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">
            <FlaskConical className="size-4 text-signal" />
            Specimen / 001
          </div>
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between border-t border-paper/20 pt-4">
            <div>
              <p className="font-serif text-3xl text-paper">Precision, not noise.</p>
              <p className="mt-1 text-sm text-paper/60">A stronger standard is coming.</p>
            </div>
            <span className="font-mono text-xs text-signal">2026—01</span>
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-y border-border bg-ink py-4 text-paper">
        <div className="animate-marquee flex min-w-max gap-12 font-mono text-[11px] uppercase tracking-[0.26em] text-paper/65">
          {Array.from({ length: 4 }).flatMap((_, loop) =>
            MARQUEE.flatMap((item, index) => [
              <span key={`${loop}-${item}`}>{item}</span>,
              <span key={`${loop}-dot-${index}`} className="text-signal">
                ●
              </span>,
            ]),
          )}
        </div>
      </div>

      <CategoryCarousel categories={slides} />

      {featuredSlots.length > 0 ? (
        <section className="bg-card px-6 py-20 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <h2 className="max-w-md font-serif text-5xl leading-[0.95] tracking-[-0.04em]">
                  Every detail has a reason.
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">Featured selections.</p>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-signal"
              >
                View all products
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
              {featuredSlots.map((product) => (
                <FeaturedProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {arrivalSlots.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="mb-12 flex items-end justify-between">
            <h2 className="font-serif text-5xl tracking-[-0.04em]">New arrivals.</h2>
            <Link
              href="/products"
              className="hidden text-xs font-bold uppercase tracking-[0.18em] text-signal md:block"
            >
              View all products →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {arrivalSlots.map((product) => (
              <FeaturedProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
