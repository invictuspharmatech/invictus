import { proxyDjango } from "@/lib/proxy-django";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/btcpostage/senders/${id}/`, {
    method: "PUT",
    body: await request.text(),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/btcpostage/senders/${id}/`, { method: "DELETE" });
}
