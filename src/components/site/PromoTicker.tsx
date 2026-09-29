import { DEFAULT_PROMO_ITEMS } from "@/lib/storefront-nav";

export function PromoTicker({ items }: { items: string[] }) {
  const line = items.length > 0 ? items : DEFAULT_PROMO_ITEMS;
  const loop = [...line, ...line, ...line, ...line];

  return (
    <div className="overflow-hidden bg-brand-red py-2 text-paper">
      <div className="animate-marquee flex min-w-max gap-10 font-mono text-[20px] font-bold uppercase tracking-[0.12em]">
        {loop.map((item, index) => (
          <span key={`${item}-${index}`} className="flex items-center gap-10">
            <span>{item}</span>
            <span aria-hidden className="text-paper/70">
              ●
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
