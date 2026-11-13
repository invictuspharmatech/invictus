import { Suspense } from "react";
import { requireFullAdmin } from "@/lib/auth";
import { ContactIpBlocks } from "@/components/admin/ContactIpBlocks";
import { ZohoMailBoard } from "@/components/admin/ZohoMailBoard";

export default async function AdminZohoMailPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <>
      <ContactIpBlocks />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Zoho Mail…</p>}>
        <ZohoMailBoard />
      </Suspense>
    </>
  );
}
