"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PROMO_ITEMS } from "@/lib/storefront-nav";

const ROTATE_MS = 6000;

export function PromoTicker({ items }: { items: string[] }) {
  const line = items.length > 0 ? items : DEFAULT_PROMO_ITEMS;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (line.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % line.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [line]);

  useEffect(() => {
    if (activeIndex >= line.length) setActiveIndex(0);
  }, [activeIndex, line.length]);

  return (
    <div
      className="relative isolate flex h-10 items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#8B0000",
        color: "#FFFFFF",
        opacity: 1,
        border: "none",
        boxShadow: "none",
        mixBlendMode: "normal",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
      aria-live="polite"
    >
      <div className="relative mx-auto flex h-10 w-full max-w-7xl items-center justify-center px-4">
        {line.map((item, index) => (
          <p
            key={`${item}-${index}`}
            className={`absolute inset-x-4 truncate text-center font-mono text-[15px] font-semibold uppercase tracking-[0.14em] text-white transition-opacity duration-500 ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
