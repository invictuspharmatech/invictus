import { proxyDjango } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouse = searchParams.get("warehouse")?.trim() || "";
  const query = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : "";
  return proxyDjango(`/api/admin/btcpostage/credits/${query}`);
}
