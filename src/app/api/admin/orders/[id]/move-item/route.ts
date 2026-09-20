import { proxyDjango } from "@/lib/proxy-django";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyDjango(`/api/admin/orders/${id}/move-item/`, { method: "POST", body });
}
