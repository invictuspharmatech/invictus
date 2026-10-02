import Link from "next/link";
import Image from "next/image";
import {
  FOOTER_COMPANY,
  FOOTER_HEADING_CLASS,
  FOOTER_LINK_CLASS,
  FOOTER_PRODUCTS,
} from "@/lib/storefront-nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ink/80">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-14 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-start lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Image
            src="/images/invictus-logo.png"
            alt="Invictus Pharma"
            width={280}
            height={280}
            className="h-40 w-40 shrink-0 object-contain sm:h-52 sm:w-52"
          />
          <p className="max-w-xs font-mono text-[20px] leading-snug tracking-[0.08em] text-muted-foreground">
            Precision performance and wellness essentials, selected with purpose.
          </p>
        </div>
        <div>
          <h2 className={FOOTER_HEADING_CLASS}>Products</h2>
          <ul className="space-y-2">
            {FOOTER_PRODUCTS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={FOOTER_LINK_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={FOOTER_HEADING_CLASS}>Company</h2>
          <ul className="space-y-2">
            {FOOTER_COMPANY.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a href={link.href} className={FOOTER_LINK_CLASS} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className={FOOTER_LINK_CLASS}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4 text-center font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
        {new Date().getFullYear()} Invictus Pharma. All Rights Reserved.
      </div>
    </footer>
  );
}
