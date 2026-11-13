"use client";

import { useEffect } from "react";

const IDLE_MS = 15 * 60 * 1000;

export function SessionIdle({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!signedIn) return;
    let last = Date.now();
    let timer = 0;

    const mark = () => {
      last = Date.now();
    };

    const tick = window.setInterval(() => {
      if (Date.now() - last >= IDLE_MS) {
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          window.location.href = "/login?session=expired";
        });
        window.clearInterval(tick);
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void fetch("/api/auth/touch", { method: "POST" }).then((response) => {
          if (response.status === 401) {
            window.location.href = "/login?signed_out=1";
          }
        });
      }, 1000);
    }, 60_000);

    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, mark));
    };
  }, [signedIn]);

  return null;
}
