"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function BtcPayInvoiceModal({
  checkoutLink,
  onClose,
  footer = "Close when you are finished. You can reopen this invoice from your orders if you need more time.",
}: {
  checkoutLink: string;
  onClose: () => void;
  footer?: string;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/75"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div
          className="relative flex w-full max-w-2xl flex-col overflow-hidden border border-border bg-background shadow-2xl"
          style={{ height: "min(85vh, calc(100dvh - 4rem))" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Bitcoin invoice</span>
            <button
              type="button"
              className="ghost-btn px-3 py-1 text-xs"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 bg-white">
            <iframe
              src={checkoutLink}
              title="BTCPay checkout"
              className="h-full min-h-[280px] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
          <p className="shrink-0 border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
            {footer}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
