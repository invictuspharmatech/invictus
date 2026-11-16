import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/users/blocked-domains/");
}

export async function POST(request: Request) {
  return proxyDjango("/api/admin/users/blocked-domains/", {
    method: "POST",
    body: await request.text(),
    headers: { "content-type": "application/json" },
  });
}
