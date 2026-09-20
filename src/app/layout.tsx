import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { CartProvider } from "@/components/shop/CartProvider";
import { ReferralCapture } from "@/components/shop/ReferralCapture";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ConditionalFooter } from "@/components/site/ConditionalFooter";
import { readSession } from "@/lib/auth";
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
    default: "Invictus Pharma | A Higher Standard",
    template: "%s | Invictus Pharma",
  },
  description:
    "Invictus is a considered collection of performance and wellness essentials, selected with the discipline of a laboratory and the eye of an artist.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();

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
          <SiteHeader session={session} />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </CartProvider>
      </body>
    </html>
  );
}
