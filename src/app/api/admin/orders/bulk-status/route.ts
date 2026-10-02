import { proxyDjango } from "@/lib/proxy-django";

export async function POST(request: Request) {
  return proxyDjango("/api/admin/orders/bulk-status/", {
    method: "POST",
    body: await request.text(),
  });
}
