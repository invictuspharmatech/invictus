import Link from "next/link";
import { Logo } from "@/components/site/Logo";

const LINKS = [
  { href: "/products", label: "Products" },
  { href: "/test-results", label: "Test results" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/cart", label: "Cart" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ink/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-14 lg:flex-row lg:items-end lg:justify-between lg:px-10">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Precision performance and wellness essentials, selected with purpose.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground transition hover:text-signal"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border px-6 py-5 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        © {new Date().getFullYear()} Invictus Pharma · Evidence over excess.
      </div>
    </footer>
  );
}
