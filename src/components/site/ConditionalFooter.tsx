"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";

export function ConditionalFooter({
  hideOnComingSoonHome = false,
}: {
  hideOnComingSoonHome?: boolean;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  if (hideOnComingSoonHome && pathname === "/") return null;
  return <SiteFooter />;
}
