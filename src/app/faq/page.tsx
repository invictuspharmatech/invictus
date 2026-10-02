import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { djangoJsonSafe } from "@/lib/django";
import { POLICY_LINKS } from "@/lib/storefront-nav";
import type { ApiFaq } from "@/lib/api-types";

export default async function FaqPage() {
  const items = await djangoJsonSafe<ApiFaq[]>("/api/cms/faq/", []);
  const sections = new Map<string, ApiFaq[]>();
  for (const item of items) {
    const current = sections.get(item.section) ?? [];
    current.push(item);
    sections.set(item.section, current);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Frequently Asked Questions"
        lede="Find answers about orders, shipping, payments, and quality."
      />
      <section className="tile mb-10">
        <h2 className="display-font text-2xl">Policies</h2>
        <ul className="mt-4 space-y-2">
          {POLICY_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="text-sm text-signal hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="space-y-10">
        {[...sections.entries()].map(([title, entries]) => (
          <section key={title}>
            <h2 className="display-font text-2xl">{title}</h2>
            <div className="mt-4 space-y-3">
              {entries.map((item) => (
                <details key={item.id} className="tile">
                  <summary className="cursor-pointer font-medium">{item.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
