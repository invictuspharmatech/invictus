"use client";

import { useRouter } from "next/navigation";

export function AffiliateReview({ id }: { id: string }) {
  const router = useRouter();

  async function act(action: "approve" | "decline") {
    await fetch(`/api/admin/affiliates/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="gold-btn" onClick={() => act("approve")}>
        Approve
      </button>
      <button type="button" className="ghost-btn" onClick={() => act("decline")}>
        Decline
      </button>
    </div>
  );
}
