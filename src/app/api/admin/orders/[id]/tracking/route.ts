import { proxyDjango } from "@/lib/proxy-django";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/orders/${id}/tracking/`, {
    method: "POST",
    body: await request.text(),
  });
}
