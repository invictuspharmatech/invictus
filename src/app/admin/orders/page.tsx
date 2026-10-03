import { requireStaff } from "@/lib/auth";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; warehouse?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { status, warehouse } = await searchParams;
  return (
    <OrdersBoard
      role={staff.role}
      initialStatus={status || "all"}
      initialWarehouse={warehouse || "BOTH"}
    />
  );
}
