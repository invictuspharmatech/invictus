"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserViewBanner() {
  const router = useRouter();

  return (
    <div className="border-b border-border bg-card px-4 py-2 text-center text-sm text-muted-foreground">
      You are shopping as a customer so you can test checkout and account pages.{" "}
      <button
        type="button"
        className="uppercase tracking-[0.16em] text-foreground"
        onClick={async () => {
          await fetch("/api/admin/view-mode", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userView: false }),
          });
          router.push("/admin");
          router.refresh();
        }}
      >
        Back to admin
      </button>
      {" · "}
      <Link href="/account" className="uppercase tracking-[0.16em] text-foreground">
        My account
      </Link>
    </div>
  );
}
