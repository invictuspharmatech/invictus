import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/contact/ban-settings/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/contact/ban-settings/", {
    method: "PUT",
    body: await request.text(),
  });
}
