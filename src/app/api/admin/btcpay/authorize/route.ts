import { proxyDjango } from "@/lib/proxy-django";

export async function POST(request: Request) {
  return proxyDjango("/api/admin/btcpay/authorize/", {
    method: "POST",
    body: await request.text(),
  });
}
