"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTO_SLIDE_MS = 5500;
const GAP_PX = 20;
const VISIBLE_ON_DESKTOP = 4;
const TRANSITION_MS = 500;
const DESKTOP_MIN_WIDTH_PX = 1024;

export type CategorySlide = {
  id: string;
  slug: string;
  name: string;
  image: string;
  blurb: string;
};

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function CategoryCardTile({ cat }: { cat: CategorySlide }) {
  return (
    <Link href={`/products?category=${cat.slug}`} className="store-card group">
      <div className="store-card-media mb-4">
        <Image
          src={cat.image}
          alt={cat.name}
          fill
          className="object-cover object-center transition duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 250px, (max-width: 1024px) 360px, 280px"
        />
      </div>
      <h3 className="text-xl font-semibold">{cat.name}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{cat.blurb}</p>
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-signal transition-all group-hover:gap-3">
        Shop now
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </p>
    </Link>
  );
}

export function CategoryCarousel({ categories }: { categories: CategorySlide[] }) {
  const isDesktop = useIsDesktop();
  const visibleCount = VISIBLE_ON_DESKTOP;
  const total = categories.length;
  const sliderActive = isDesktop && total > visibleCount;
  const canSlide = sliderActive;
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const pendingPrevWrap = useRef(false);

  const loopedCards = useMemo(() => {
    if (total === 0) return [];
    return [...categories, ...categories.slice(0, visibleCount)];
  }, [categories, total, visibleCount]);

  useEffect(() => {
    setActiveIndex(0);
    setTransitionEnabled(true);
    pendingPrevWrap.current = false;
  }, [total, visibleCount]);

  const goNext = useCallback(() => {
    if (!canSlide) return;
    setTransitionEnabled(true);
    setActiveIndex((i) => (i >= total ? i : i + 1));
  }, [canSlide, total]);

  const goPrev = useCallback(() => {
    if (!canSlide) return;
    setActiveIndex((i) => {
      if (i === 0) {
        pendingPrevWrap.current = true;
        setTransitionEnabled(false);
        return total;
      }
      setTransitionEnabled(true);
      return i - 1;
    });
  }, [canSlide, total]);

  useEffect(() => {
    if (!canSlide || activeIndex !== total || pendingPrevWrap.current) return;
    const timer = window.setTimeout(() => {
      setTransitionEnabled(false);
      setActiveIndex(0);
    }, TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, canSlide, total]);

  useEffect(() => {
    if (!canSlide || activeIndex !== total || !pendingPrevWrap.current || transitionEnabled) {
      return;
    }
    pendingPrevWrap.current = false;
    const id = requestAnimationFrame(() => {
      setTransitionEnabled(true);
      setActiveIndex(total - 1);
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, canSlide, total, transitionEnabled]);

  useEffect(() => {
    if (!canSlide || activeIndex !== 0 || transitionEnabled) return;
    const id = requestAnimationFrame(() => {
      setTransitionEnabled(true);
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, canSlide, transitionEnabled]);

  useEffect(() => {
    if (paused || !canSlide) return;
    const timer = window.setInterval(goNext, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, canSlide, goNext]);

  const slideOffset = useMemo(() => {
    if (activeIndex === 0) return "0";
    const cardShare = `(100% - ${(visibleCount - 1) * GAP_PX}px) / ${visibleCount}`;
    return `calc(-${activeIndex} * (${cardShare} + ${GAP_PX}px))`;
  }, [activeIndex, visibleCount]);

  const dotIndex = activeIndex >= total ? 0 : activeIndex;

  if (categories.length === 0) return null;

  return (
    <section className="home-band home-band-categories px-6 py-20 lg:px-10 lg:py-28">
      <div className="home-band-inner mx-auto max-w-7xl">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-signal">Product categories</p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.03em] sm:text-4xl">Find your protocol.</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
            Choose a category to explore products.
          </p>
        </div>
        {sliderActive ? (
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous categories"
              className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/10 text-foreground transition hover:bg-white/20 hover:text-signal"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next categories"
              className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/10 text-foreground transition hover:bg-white/20 hover:text-signal"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {sliderActive ? (
          <div className="overflow-hidden">
            <div
              className={`flex ease-out ${transitionEnabled ? "transition-transform duration-500" : ""}`}
              style={{
                gap: `${GAP_PX}px`,
                transform: `translateX(${slideOffset})`,
              }}
            >
              {loopedCards.map((cat, i) => (
                <div
                  key={`${cat.id}-${i}`}
                  className="min-w-0 shrink-0"
                  style={{
                    flexBasis: `calc((100% - ${(visibleCount - 1) * GAP_PX}px) / ${visibleCount})`,
                  }}
                >
                  <CategoryCardTile cat={cat} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {categories.map((cat) => (
              <CategoryCardTile key={cat.id} cat={cat} />
            ))}
          </div>
        )}

      {sliderActive ? (
          <div className="mt-6 hidden items-center justify-center gap-2 lg:flex">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show category slide ${i + 1}`}
                onClick={() => {
                  pendingPrevWrap.current = false;
                  setTransitionEnabled(true);
                  setActiveIndex(i);
                }}
                className={`h-2 rounded-full transition-all ${
                  i === dotIndex ? "w-7 bg-signal" : "w-2 bg-border hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}
