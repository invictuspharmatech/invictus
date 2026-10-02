import { requireStaff } from "@/lib/auth";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export default async function AdminOrdersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  return <OrdersBoard role={staff.role} />;
}
