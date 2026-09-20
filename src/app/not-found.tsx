import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">404</p>
      <h1 className="display-font mt-3 text-4xl">Page not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        That route is not part of the Invictus catalog.
      </p>
      <Link href="/" className="gold-btn mt-8 inline-flex">
        Return home
      </Link>
    </div>
  );
}
