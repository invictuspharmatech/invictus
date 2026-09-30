import { proxyDjango } from "@/lib/proxy-django";

export async function POST(request: Request) {
  const url = new URL(request.url);
  return proxyDjango(`/api/orders/pay/invoice/${url.search}`, {
    method: "POST",
    body: await request.text(),
  });
}
