import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/btcpostage/senders/");
}

export async function POST(request: Request) {
  return proxyDjango("/api/admin/btcpostage/senders/", {
    method: "POST",
    body: await request.text(),
  });
}
