"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const KEY = "invictus-ref";

export function ReferralCapture() {
  const params = useSearchParams();
  const code = params.get("ref");

  useEffect(() => {
    if (!code) return;
    document.cookie = `${KEY}=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 60}`;
  }, [code]);

  return null;
}

export function readReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )invictus-ref=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
