import { proxyDjango } from "@/lib/proxy-django";

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const path = `/api/admin/users/${incoming.search}`;
  return proxyDjango(path);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyDjango("/api/admin/users/", { method: "POST", body });
}
