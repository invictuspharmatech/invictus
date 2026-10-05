import { requireFullAdmin } from "@/lib/auth";
import { CreateOrderBoard } from "@/components/admin/CreateOrderBoard";

export default async function AdminCreateOrderPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return <CreateOrderBoard />;
}
