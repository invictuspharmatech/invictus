import { proxyDjango } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyDjango(`/api/admin/orders/customer-lookup/${url.search}`);
}
