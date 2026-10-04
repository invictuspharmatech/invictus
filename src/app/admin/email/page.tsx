import { requireFullAdmin } from "@/lib/auth";
import { BulkEmailBoard } from "@/components/admin/BulkEmailBoard";

export default async function AdminBulkEmailPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return <BulkEmailBoard />;
}
