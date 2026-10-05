"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bannerBgColor, bannerTextColor } from "@/lib/feature-banners";
import { DEFAULT_PROMO_ITEMS } from "@/lib/storefront-nav";
import type { BannerBgMode, BannerTextMode } from "@/lib/api-types";

export type PromoSlide = {
  id: string;
  title: string;
  href?: string;
  bgColorMode?: BannerBgMode | string;
  textColorMode?: BannerTextMode | string;
};

const ROTATE_MS = 6000;

function fallbackSlides(): PromoSlide[] {
  return DEFAULT_PROMO_ITEMS.map((title, index) => ({
    id: `default-${index}`,
    title,
    bgColorMode: "danger",
    textColorMode: "light",
  }));
}

function SlideText({ slide, className }: { slide: PromoSlide; className?: string }) {
  const color = bannerTextColor(slide.textColorMode);
  if (slide.href) {
    return (
      <Link href={slide.href} className={className} style={{ color }}>
        {slide.title}
      </Link>
    );
  }
  return (
    <span className={className} style={{ color }}>
      {slide.title}
    </span>
  );
}

export function PromoTicker({
  items,
  enabled = true,
  displayMode = "slider",
}: {
  items: PromoSlide[];
  enabled?: boolean;
  displayMode?: "marquee" | "slider";
}) {
  const slides = items.length > 0 ? items : fallbackSlides();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (displayMode !== "slider" || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [displayMode, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  const marqueeSlides = useMemo(
    () => (slides.length > 0 ? [...slides, ...slides] : []),
    [slides],
  );
  const marqueeDuration = `${Math.max(slides.length * 9, 24)}s`;

  if (!enabled) return null;

  if (displayMode === "marquee") {
    const bg = bannerBgColor(slides[0]?.bgColorMode);
    return (
      <div
        className="relative isolate flex h-10 items-center overflow-hidden"
        style={{ backgroundColor: bg }}
        aria-label="Feature banner announcements"
      >
        <div
          className="feature-banner-marquee-track"
          style={{ ["--banner-marquee-duration" as string]: marqueeDuration }}
        >
          {marqueeSlides.map((slide, index) => (
            <span key={`${slide.id}-${index}`} className="feature-banner-marquee-item">
              <SlideText slide={slide} className="font-semibold tracking-wide hover:underline" />
              {index < marqueeSlides.length - 1 ? (
                <span className="feature-banner-marquee-separator" aria-hidden>
                  •
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const current = slides[activeIndex] ?? slides[0];
  return (
    <div
      className="relative isolate flex h-10 items-center justify-center overflow-hidden"
      style={{ backgroundColor: bannerBgColor(current?.bgColorMode) }}
      aria-live="polite"
    >
      <div className="relative mx-auto flex h-10 w-full max-w-7xl items-center justify-center px-4">
        {slides.map((slide, index) => (
          <p
            key={slide.id}
            className={`absolute inset-x-4 truncate text-center font-mono text-[15px] font-semibold uppercase tracking-[0.14em] transition-opacity duration-500 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <SlideText slide={slide} />
          </p>
        ))}
      </div>
    </div>
  );
}
