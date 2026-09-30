import { proxyDjango } from "@/lib/proxy-django";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/btc/order/${id}/invoice/`);
}
