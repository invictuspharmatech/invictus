import { proxyDjango } from "@/lib/proxy-django";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyDjango(`/api/admin/stock-notifications/batches/${id}/`, { method: "POST", body });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/stock-notifications/batches/${id}/`, { method: "DELETE" });
}
