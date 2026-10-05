import { proxyDjangoFile } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjangoFile("/api/admin/categories/export/");
}
