import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { CartProvider } from "@/components/shop/CartProvider";
import { ReferralCapture } from "@/components/shop/ReferralCapture";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ConditionalFooter } from "@/components/site/ConditionalFooter";
import { readSession } from "@/lib/auth";
import { djangoJsonSafe } from "@/lib/django";
import { SHOP_CATEGORIES } from "@/lib/storefront-nav";
import type { ApiBanner, ApiCategory } from "@/lib/api-types";
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
    icon: "/images/invictus-logo.png",
    apple: "/images/invictus-logo.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  const [categories, banners] = await Promise.all([
    djangoJsonSafe<ApiCategory[]>("/api/categories/", []),
    djangoJsonSafe<ApiBanner[]>("/api/cms/banners/", []),
  ]);
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
  const promoItems = banners
    .filter((item) => item.isActive)
    .map((item) => [item.title, item.subtitle].filter(Boolean).join(" · "))
    .filter(Boolean);

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
          <SiteHeader session={session} shopLinks={shopLinks} promoItems={promoItems} />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </CartProvider>
      </body>
    </html>
  );
}
