import { proxyDjango } from "@/lib/proxy-django";

export async function POST() {
  return proxyDjango("/api/admin/btcpay/webhook/", { method: "POST", body: "{}" });
}
