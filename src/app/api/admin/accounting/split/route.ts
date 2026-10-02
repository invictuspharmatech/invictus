import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/accounting/split/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/accounting/split/", {
    method: "PUT",
    body: await request.text(),
  });
}

export async function POST(request: Request) {
  return proxyDjango("/api/admin/accounting/split/", {
    method: "POST",
    body: await request.text(),
  });
}
