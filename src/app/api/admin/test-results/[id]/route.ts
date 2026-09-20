import { proxyDjango } from "@/lib/proxy-django";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyDjango(`/api/admin/test-results/${id}/`, { method: "PUT", body });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/test-results/${id}/`, { method: "DELETE" });
}
