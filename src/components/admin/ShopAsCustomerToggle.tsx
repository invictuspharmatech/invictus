"use client";

import { useRouter } from "next/navigation";

export function ShopAsCustomerToggle() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
      onClick={async () => {
        await fetch("/api/admin/view-mode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userView: true }),
        });
        router.push("/");
        router.refresh();
      }}
    >
      User view
    </button>
  );
}
