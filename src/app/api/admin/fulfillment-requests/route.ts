import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/fulfillment-requests/");
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/fulfillment-requests/", { method: "POST", body });
}
