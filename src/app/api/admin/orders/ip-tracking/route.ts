import { proxyDjango } from "@/lib/proxy-django";

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/orders/ip-tracking/", {
    method: "PUT",
    body: await request.text(),
  });
}

export async function DELETE() {
  return proxyDjango("/api/admin/orders/ip-tracking/", { method: "DELETE" });
}
