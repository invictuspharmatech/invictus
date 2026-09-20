import { PageHeader } from "@/components/site/PageHeader";
import { djangoJson } from "@/lib/django";
import type { ApiFaq } from "@/lib/api-types";

export default async function FaqPage() {
  const items = await djangoJson<ApiFaq[]>("/api/cms/faq/");
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
