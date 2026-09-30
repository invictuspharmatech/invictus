import { proxyDjango } from "@/lib/proxy-django";

export async function GET(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await context.params;
  const url = new URL(request.url);
  return proxyDjango(`/api/btc/invoice/status/${invoiceId}/${url.search}`);
}
