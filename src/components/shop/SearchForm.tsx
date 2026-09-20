"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ProductsSearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl gap-2">
      <input
        className="field"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
      />
      <button className="gold-btn" type="submit">
        Search
      </button>
    </form>
  );
}
