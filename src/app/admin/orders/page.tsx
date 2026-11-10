import { requireStaff } from "@/lib/auth";
import { OrdersBoard } from "@/components/admin/OrdersBoard";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; warehouse?: string; trashed?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { status, warehouse, trashed } = await searchParams;
  return (
    <OrdersBoard
      role={staff.role}
      initialStatus={status || "all"}
      initialWarehouse={warehouse || "BOTH"}
      initialTrashed={trashed === "1" || trashed === "true"}
    />
  );
}
