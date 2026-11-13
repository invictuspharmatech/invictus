import { proxyDjango } from "@/lib/proxy-django";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/contact/ip-blocks/${id}/`, { method: "DELETE" });
}
