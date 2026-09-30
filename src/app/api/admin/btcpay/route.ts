import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/btcpay/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/btcpay/", {
    method: "PUT",
    body: await request.text(),
  });
}
