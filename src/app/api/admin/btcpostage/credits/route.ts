import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/btcpostage/credits/");
}
