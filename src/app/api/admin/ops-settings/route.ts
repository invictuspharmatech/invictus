import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/ops-settings/");
}

export async function PUT(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/ops-settings/", { method: "PUT", body });
}
