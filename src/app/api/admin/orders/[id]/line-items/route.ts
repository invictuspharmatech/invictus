import { proxyDjango } from "@/lib/proxy-django";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyDjango(`/api/admin/orders/${id}/line-items/`, { method: "PUT", body });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyDjango(`/api/admin/orders/${id}/line-items/`, { method: "PATCH", body });
}
