import { proxyDjango } from "@/lib/proxy-django";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/products/import/", { method: "POST", body });
}
