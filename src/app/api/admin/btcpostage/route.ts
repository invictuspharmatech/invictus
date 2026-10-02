import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/btcpostage/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/btcpostage/", {
    method: "PUT",
    body: await request.text(),
  });
}
