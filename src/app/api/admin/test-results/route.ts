import { proxyDjango } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyDjango(`/api/admin/test-results/${url.search}`);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/test-results/", { method: "POST", body });
}
