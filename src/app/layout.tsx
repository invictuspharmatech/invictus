import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import { CartProvider } from "@/components/shop/CartProvider";
import { ReferralCapture } from "@/components/shop/ReferralCapture";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ConditionalFooter } from "@/components/site/ConditionalFooter";
import { readSession } from "@/lib/auth";
import { djangoJsonSafe } from "@/lib/django";
import { SHOP_CATEGORIES } from "@/lib/storefront-nav";
import type { ApiCategory } from "@/lib/api-types";
import { asBannerRuntime } from "@/lib/feature-banners";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Invictus Pharma",
    template: "%s | Invictus Pharma",
  },
  description:
    "Invictus is a considered collection of performance and wellness essentials, selected with the discipline of a laboratory and the eye of an artist.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/site-icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-invictus-pathname") || "";
  const isAdminApp = pathname.startsWith("/admin");
  const session = isAdminApp ? null : await readSession();
  const [categories, bannerPayload] = (
    isAdminApp
      ? [[], { items: [], enabled: true, displayMode: "marquee" }]
      : await Promise.all([
          djangoJsonSafe<ApiCategory[]>("/api/categories/", []),
          djangoJsonSafe("/api/cms/banners/", { items: [], enabled: true, displayMode: "marquee" }),
        ])
  ) as [ApiCategory[], unknown];
  const banners = asBannerRuntime(bannerPayload);
  const shopLinks =
    categories.length > 0
      ? [
          { href: "/products", label: "All products" },
          ...categories.map((item) => ({
            href: `/products?category=${item.slug}`,
            label: item.name,
          })),
        ]
      : SHOP_CATEGORIES;
  const promoItems = banners.items
    .filter((item) => item.isActive)
    .map((item) => ({
      id: item.id,
      title: [item.title, item.subtitle].filter(Boolean).join(" · "),
      href: item.href || undefined,
      bgColorMode: item.bgColorMode,
      textColorMode: item.textColorMode,
    }));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          <SiteHeader
            session={session}
            shopLinks={shopLinks}
            promoItems={promoItems}
            promoEnabled={banners.enabled}
            promoDisplayMode={banners.displayMode}
          />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </CartProvider>
      </body>
    </html>
  );
}
