import { proxyDjango } from "@/lib/proxy-django";

export async function POST() {
  return proxyDjango("/api/admin/users/logout-all/", { method: "POST" });
}
