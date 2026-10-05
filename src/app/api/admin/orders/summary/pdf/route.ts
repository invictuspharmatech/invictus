import { proxyDjangoFile } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyDjangoFile(`/api/admin/orders/summary/pdf/${url.search}`);
}
