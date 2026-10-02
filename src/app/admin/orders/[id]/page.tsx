import { requireStaff } from "@/lib/auth";
import { DjangoError, djangoAuthed } from "@/lib/django";
import { OrderDetailBoard } from "@/components/admin/OrderDetailBoard";
import type { ApiOrder, ApiWarehouseSettings } from "@/lib/api-types";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { id } = await params;
  try {
    const [order, policy] = await Promise.all([
      djangoAuthed<ApiOrder>(`/api/admin/orders/${id}/`),
      djangoAuthed<ApiWarehouseSettings>("/api/cms/warehouse-policy/"),
    ]);
    return <OrderDetailBoard initial={order} policy={policy} role={staff.role} />;
  } catch (error) {
    if (error instanceof DjangoError && error.status === 404) {
      return <p className="text-sm text-muted-foreground">Order not found.</p>;
    }
    throw error;
  }
}
