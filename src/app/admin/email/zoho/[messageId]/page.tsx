import { Suspense } from "react";
import { requireFullAdmin } from "@/lib/auth";
import { ZohoMailMessageBoard } from "@/components/admin/ZohoMailMessageBoard";

export default async function AdminZohoMailMessagePage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const { messageId } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading message…</p>}>
      <ZohoMailMessageBoard messageId={messageId} />
    </Suspense>
  );
}
