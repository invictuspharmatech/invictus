import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const CARDS = [
  { href: "/admin/cms/pages", title: "Pages" },
  { href: "/admin/cms/faq", title: "FAQ" },
  { href: "/admin/cms/banners", title: "Banners" },
  { href: "/admin/cms/test-results", title: "Test results" },
  { href: "/admin/cms/media", title: "Media library" },
  { href: "/admin/cms/settings", title: "Site settings" },
  { href: "/admin/cms/coming-soon", title: "Coming soon" },
  { href: "/admin/cms/email", title: "Email settings & templates" },
  { href: "/admin/warehouses", title: "Warehouses" },
  { href: "/admin/products", title: "Catalog" },
];

export default async function CmsHubPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">CMS</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="tile">
            <h2 className="text-lg">{card.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
