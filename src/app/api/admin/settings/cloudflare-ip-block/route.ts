import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/settings/cloudflare-ip-block/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/settings/cloudflare-ip-block/", {
    method: "PUT",
    body: await request.text(),
  });
}
