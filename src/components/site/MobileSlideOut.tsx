"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const BREAKPOINT_MIN_WIDTH: Record<string, string> = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

function minWidthForHiddenFrom(hiddenFrom: string): string {
  const key = hiddenFrom.split(":")[0] || "lg";
  return BREAKPOINT_MIN_WIDTH[key] ?? BREAKPOINT_MIN_WIDTH.lg;
}

export function MobileSlideOut({
  open,
  onClose,
  title = "Menu",
  hiddenFrom = "lg:hidden",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Breakpoint where the menu button hides; overlay auto-closes at that width. */
  hiddenFrom?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    const mq = window.matchMedia(`(min-width: ${minWidthForHiddenFrom(hiddenFrom)})`);
    function onViewportChange() {
      if (mq.matches) onClose();
    }
    onViewportChange();
    mq.addEventListener("change", onViewportChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onViewportChange);
    };
  }, [open, onClose, hiddenFrom]);

  if (!mounted || !open) return null;

  // Portal to body so the drawer is never trapped inside page scroll/overflow
  // containers (e.g. orders table overflow-x-auto + sticky columns on mobile).
  return createPortal(
    <div
      className="fixed inset-0 z-[200] h-[100dvh] w-screen"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/70"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 z-10 flex h-full w-[min(100%,24rem)] max-w-sm flex-col overflow-hidden border-l border-border bg-background text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <span className="font-mono text-[16px] uppercase tracking-[0.12em] text-foreground">
            {title}
          </span>
          <button type="button" className="p-2" aria-label="Close menu" onClick={onClose}>
            <X className="size-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
