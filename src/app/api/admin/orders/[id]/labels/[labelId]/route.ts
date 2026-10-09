import { proxyDjango } from "@/lib/proxy-django";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; labelId: string }> },
) {
  const { id, labelId } = await context.params;
  return proxyDjango(`/api/admin/orders/${id}/labels/${labelId}/`, { method: "DELETE" });
}
