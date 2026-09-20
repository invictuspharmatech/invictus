import Link from "next/link";
import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3 text-foreground">
      <Image
        src="/images/invictus-logo.png"
        alt="Invictus Pharma"
        width={42}
        height={42}
        className="size-9 object-contain transition group-hover:rotate-6"
      />
      {compact ? null : (
        <span className="hidden sm:block">
          <span className="block font-mono text-xs font-bold tracking-[.28em]">INVICTUS</span>
          <span className="block font-mono text-[9px] tracking-[.42em] text-muted-foreground">
            PHARMA
          </span>
        </span>
      )}
    </Link>
  );
}
