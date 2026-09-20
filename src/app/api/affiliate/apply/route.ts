import { proxyDjango } from "@/lib/proxy-django";

export async function POST() {
  return proxyDjango("/api/affiliate/apply/", { method: "POST", body: "{}" });
}
