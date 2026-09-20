import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  FileCheck,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { djangoJson } from "@/lib/django";
import { FeaturedProductCard } from "@/components/shop/FeaturedProductCard";
import {
  CATEGORY_BLURBS,
  CATEGORY_IMAGES,
  HOME_PROTOCOL_SLUGS,
} from "@/lib/constants";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

const MARQUEE = [
  "Precision / Purpose / Progress",
  "Evidence over excess",
  "Built for the long game",
];

const DETAILS = [
  {
    title: "Considered selection",
    copy: "A focused catalog built around clarity, consistency, and purpose.",
    icon: ShieldCheck,
  },
  {
    title: "Transparent by design",
    copy: "Test results and product context are never buried behind the sale.",
    icon: FileCheck,
  },
  {
    title: "Protocol-minded",
    copy: "Simple systems for people who take the long view.",
    icon: FlaskConical,
  },
  {
    title: "No unnecessary noise",
    copy: "The right information, presented with restraint.",
    icon: Check,
  },
];

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    djangoJson<ApiCategory[]>(`/api/categories/?slugs=${HOME_PROTOCOL_SLUGS.join(",")}`),
    djangoJson<ApiProduct[]>("/api/products/?featured=1&limit=4"),
  ]);

  const protocol = HOME_PROTOCOL_SLUGS.map((slug) =>
    categories.find((item) => item.slug === slug),
  ).filter((item): item is ApiCategory => Boolean(item));

  let showcase = featured.slice(0, 4);
  if (showcase.length === 0) {
    showcase = await djangoJson<ApiProduct[]>("/api/products/?limit=4");
  }

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
              className="h-32 w-32 shrink-0 object-contain sm:h-40 sm:w-40"
              priority
            />
            <h1 className="max-w-3xl font-serif text-6xl leading-[0.9] tracking-[-0.055em] text-balance sm:text-8xl lg:text-[7.2rem]">
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

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h2 className="mt-3 font-serif text-5xl tracking-[-0.04em]">Find your protocol.</h2>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            A tight edit of future-facing categories. No clutter. Just the essentials, clearly
            presented.
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[880px] grid-cols-4 gap-px bg-border">
            {protocol.map((category, index) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="group bg-background p-4 transition hover:bg-card"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-card">
                  <Image
                    src={CATEGORY_IMAGES[category.slug] ?? "/images/featured-display.jpg"}
                    alt={category.name}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 font-mono text-xs text-signal">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 pt-5">
                  <div>
                    <h3 className="font-serif text-2xl">{category.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {CATEGORY_BLURBS[category.slug] ?? "Browse the collection."}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-1 size-5 text-signal transition group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="mt-4 max-w-md font-serif text-5xl leading-[0.95] tracking-[-0.04em]">
              Every detail has a reason.
            </h2>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-signal"
            >
              About the standard
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            {DETAILS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="border-t border-border pt-5">
                  <Icon className="size-5 text-signal" />
                  <h3 className="mt-5 font-serif text-2xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 flex items-end justify-between">
          <h2 className="mt-3 font-serif text-5xl tracking-[-0.04em]">Featured selections.</h2>
          <Link
            href="/products"
            className="hidden text-xs font-bold uppercase tracking-[0.18em] text-signal md:block"
          >
            View all products →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {showcase.map((product) => (
            <FeaturedProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="brand-gradient mx-6 mb-8 px-6 py-16 text-signal-foreground sm:px-12 lg:mx-10 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-70">
              Stay close / 04
            </p>
            <h2 className="mt-4 max-w-2xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              The next protocol starts here.
            </h2>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 border-b border-current pb-3 text-xs font-bold uppercase tracking-[0.18em]"
          >
            Get in touch
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
