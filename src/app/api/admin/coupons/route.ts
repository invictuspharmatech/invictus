import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/coupons/");
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/coupons/", { method: "POST", body });
}
