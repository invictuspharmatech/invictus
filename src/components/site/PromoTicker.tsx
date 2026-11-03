"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
const BANNER_MIN_FONT_PX = 9;
const BANNER_MAX_FONT_PX_MOBILE = 14;
const BANNER_MAX_FONT_PX_DESKTOP = 16;
const BANNER_STRIP_MIN_HEIGHT_PX = 40;
const BANNER_STRIP_MAX_HEIGHT_PX = 56;

function fallbackSlides(): PromoSlide[] {
  return DEFAULT_PROMO_ITEMS.map((title, index) => ({
    id: `default-${index}`,
    title,
    bgColorMode: "danger",
    textColorMode: "light",
  }));
}

function slideColor(slide: PromoSlide): string {
  return bannerTextColor(slide.textColorMode);
}

function SlideLink({
  slide,
  className,
  style,
  children,
}: {
  slide: PromoSlide;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (slide.href) {
    return (
      <Link href={slide.href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}

function useBannerTextFit(text: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(BANNER_MAX_FONT_PX_MOBILE);
  const [requiredHeight, setRequiredHeight] = useState(BANNER_STRIP_MIN_HEIGHT_PX);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    const fit = () => {
      const maxPx = window.matchMedia("(min-width: 768px)").matches
        ? BANNER_MAX_FONT_PX_DESKTOP
        : BANNER_MAX_FONT_PX_MOBILE;
      const available = container.clientWidth;

      el.style.whiteSpace = "nowrap";
      el.style.lineHeight = "1.25";
      let size = maxPx;
      el.style.fontSize = `${size}px`;

      while (size > BANNER_MIN_FONT_PX && el.scrollWidth > available) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }

      if (el.scrollWidth > available) {
        el.style.whiteSpace = "normal";
        el.style.fontSize = `${BANNER_MIN_FONT_PX}px`;
        size = BANNER_MIN_FONT_PX;
        const textHeight = el.getBoundingClientRect().height;
        setRequiredHeight(
          Math.max(
            BANNER_STRIP_MIN_HEIGHT_PX,
            Math.min(BANNER_STRIP_MAX_HEIGHT_PX, Math.ceil(textHeight + 10)),
          ),
        );
      } else {
        setRequiredHeight(BANNER_STRIP_MIN_HEIGHT_PX);
      }

      setFontSize(size);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    window.addEventListener("resize", fit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [text]);

  return { containerRef, textRef, fontSize, requiredHeight };
}

function SliderMessage({
  slide,
  onRequiredHeight,
}: {
  slide: PromoSlide;
  onRequiredHeight?: (height: number) => void;
}) {
  const { containerRef, textRef, fontSize, requiredHeight } = useBannerTextFit(slide.title);

  useEffect(() => {
    onRequiredHeight?.(requiredHeight);
  }, [requiredHeight, onRequiredHeight]);

  const message = (
    <span
      ref={textRef}
      className="feature-banner-slider-message inline-block max-w-full text-center font-mono font-semibold uppercase leading-tight tracking-wide hover:underline"
      style={{ color: slideColor(slide), fontSize: `${fontSize}px` }}
    >
      {slide.title}
    </span>
  );

  return (
    <div ref={containerRef} className="feature-banner-slider-fit w-full px-3 sm:px-4">
      {slide.href ? (
        <Link href={slide.href} className="block w-full text-center">
          {message}
        </Link>
      ) : (
        message
      )}
    </div>
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
  const [stripHeight, setStripHeight] = useState(BANNER_STRIP_MIN_HEIGHT_PX);

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
              <SlideLink
                slide={slide}
                className="font-mono font-semibold uppercase tracking-wide hover:underline"
                style={{ color: slideColor(slide) }}
              >
                {slide.title}
              </SlideLink>
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
      className="relative isolate w-full overflow-hidden transition-[height] duration-300"
      style={{
        backgroundColor: bannerBgColor(current?.bgColorMode),
        minHeight: `${stripHeight}px`,
        height: `${stripHeight}px`,
      }}
      aria-live="polite"
      aria-label="Feature banner announcements"
    >
      <div
        className="relative mx-auto flex w-full max-w-7xl items-center justify-center overflow-hidden"
        style={{ minHeight: `${stripHeight}px`, height: `${stripHeight}px` }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`feature-banner-slider-panel absolute inset-0 flex items-center justify-center ${
              index === activeIndex ? "feature-banner-slider-panel-active" : ""
            }`}
            aria-hidden={index !== activeIndex}
          >
            <SliderMessage
              slide={slide}
              onRequiredHeight={index === activeIndex ? setStripHeight : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
