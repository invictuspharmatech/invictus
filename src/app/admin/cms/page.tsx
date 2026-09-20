import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const CARDS = [
  {
    href: "/admin/cms/pages",
    title: "Pages",
    copy: "About, shipping, terms, quality guarantee, and other HTML pages.",
  },
  {
    href: "/admin/cms/faq",
    title: "FAQ",
    copy: "Questions and answers shown on the storefront FAQ.",
  },
  {
    href: "/admin/cms/banners",
    title: "Banners",
    copy: "Homepage and campaign banners.",
  },
  {
    href: "/admin/cms/test-results",
    title: "Test results",
    copy: "Lab documents listed on Test Results.",
  },
  {
    href: "/admin/cms/settings",
    title: "Site settings",
    copy: "Homepage headline and other store copy.",
  },
  {
    href: "/admin/cms/email",
    title: "Email & notifications",
    copy: "SMTP settings, email templates, and who receives each notification.",
  },
  {
    href: "/admin/cms/warehouses",
    title: "Warehouses",
    copy: "Split orders, auto-cover shortages, manual moves, and warehouse requests.",
  },
  {
    href: "/admin/products",
    title: "Catalog",
    copy: "Create and edit products, images, prices, and warehouses.",
  },
];

export default async function CmsHubPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">CMS</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Edit storefront copy here. The full Django admin at{" "}
        <a className="underline" href="http://127.0.0.1:8000/admin/" target="_blank" rel="noreferrer">
          127.0.0.1:8000/admin
        </a>{" "}
        has the same content plus media uploads.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="tile">
            <h2 className="text-lg">{card.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{card.copy}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
