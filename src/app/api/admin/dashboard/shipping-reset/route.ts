import { proxyDjango } from "@/lib/proxy-django";

export async function POST() {
  return proxyDjango("/api/admin/dashboard/shipping-reset/", { method: "POST", body: "{}" });
}
