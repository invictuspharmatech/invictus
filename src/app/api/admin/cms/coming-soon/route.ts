import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/cms/coming-soon/");
}

export async function PUT(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/cms/coming-soon/", { method: "PUT", body });
}
