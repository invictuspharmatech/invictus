"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AffiliateApplyButton({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    pending ? "Application pending review." : null,
  );

  if (pending) {
    return <p className="text-sm text-muted-foreground">{message}</p>;
  }

  return (
    <button
      type="button"
      className="ghost-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/affiliate/apply", { method: "POST" });
        const data = (await response.json()) as { error?: string };
        setBusy(false);
        if (!response.ok) {
          setMessage(data.error || "Could not apply.");
          return;
        }
        setMessage("Application submitted.");
        router.refresh();
      }}
    >
      Apply to affiliate program
    </button>
  );
}
