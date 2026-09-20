import { proxyDjango } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyDjango(`/api/admin/products/${url.search}`);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/products/", { method: "POST", body });
}
