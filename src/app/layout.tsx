import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";
import { headers } from "next/headers";
import { SessionIdle } from "@/components/auth/SessionIdle";
import { CartProvider } from "@/components/shop/CartProvider";
import { ReferralCapture } from "@/components/shop/ReferralCapture";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ConditionalFooter } from "@/components/site/ConditionalFooter";
import { readSession } from "@/lib/auth";
import { djangoJsonSafe } from "@/lib/django";
import { SHOP_CATEGORIES } from "@/lib/storefront-nav";
import type { ApiCategory } from "@/lib/api-types";
import { asBannerRuntime } from "@/lib/feature-banners";
import { COMING_SOON_FALLBACK, type ComingSoonPublic } from "@/lib/coming-soon";
import "./globals.css";

// Self-hosted fonts — next/font/google can crash Docker/CI builds when Google
// returns extensionless /l/font?kit= URLs (Next.js #99114).
const cinzel = localFont({
  src: [
    { path: "./fonts/cinzel-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cinzel-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cinzel-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cinzel-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cinzel",
  display: "swap",
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
  const comingSoon = isAdminApp
    ? COMING_SOON_FALLBACK
    : await djangoJsonSafe<ComingSoonPublic>("/api/cms/coming-soon/", COMING_SOON_FALLBACK);
  const session = isAdminApp ? null : await readSession();
  // Always load storefront chrome data when coming-soon is on — only `/` hides
  // the menu; other routes must keep working with the normal header/footer.
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${cinzel.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <SessionIdle signedIn={Boolean(session)} />
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          <SiteHeader
            session={session}
            shopLinks={shopLinks}
            promoItems={promoItems}
            promoEnabled={banners.enabled}
            promoDisplayMode={banners.displayMode}
            hideOnComingSoonHome={comingSoon.enabled}
          />
          <main className="flex-1">{children}</main>
          <ConditionalFooter hideOnComingSoonHome={comingSoon.enabled} />
        </CartProvider>
      </body>
    </html>
  );
}
