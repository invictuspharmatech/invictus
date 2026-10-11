"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

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
  hiddenFrom?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] ${hiddenFrom}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/70" aria-hidden onClick={onClose} />
      <div className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col overflow-hidden border-l border-border bg-background text-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-mono text-[16px] uppercase tracking-[0.12em] text-foreground">{title}</span>
          <button type="button" className="p-2" aria-label="Close menu" onClick={onClose}>
            <X className="size-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}
