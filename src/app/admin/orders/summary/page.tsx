import { requireStaff } from "@/lib/auth";
import { OrderSummaryBoard } from "@/components/admin/OrderSummaryBoard";

export default async function AdminOrderSummaryPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  return <OrderSummaryBoard />;
}
