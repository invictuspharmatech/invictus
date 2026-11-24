import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/admin/cms/footer-telegram/");
}

export async function PUT(request: Request) {
  return proxyDjango("/api/admin/cms/footer-telegram/", {
    method: "PUT",
    body: await request.text(),
  });
}
