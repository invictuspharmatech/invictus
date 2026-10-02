import { proxyDjango } from "@/lib/proxy-django";

export async function POST(request: Request) {
  return proxyDjango("/api/admin/btcpostage/charge/", {
    method: "POST",
    body: await request.text(),
  });
}
