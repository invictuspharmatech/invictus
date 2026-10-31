import { requireStaff } from "@/lib/auth";
import { OrderSummaryBoard } from "@/components/admin/OrderSummaryBoard";

export default async function AdminOrderSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { warehouse } = await searchParams;
  return (
    <OrderSummaryBoard role={staff.role} initialWarehouse={warehouse || "BOTH"} />
  );
}
