import { proxyDjango } from "@/lib/proxy-django";

export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/orders/${id}/label/`, {
    method: "POST",
    body: await request.text(),
  });
}
