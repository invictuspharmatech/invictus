"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function HeaderSearch({
  className = "relative hidden min-w-40 max-w-56 xl:block",
  inputId = "header-search",
}: {
  className?: string;
  inputId?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    if (!q) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <label className="sr-only" htmlFor={inputId}>
        Search products
      </label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={inputId}
        className="w-full rounded-full border border-border bg-card py-1.5 pl-8 pr-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search"
      />
    </form>
  );
}
