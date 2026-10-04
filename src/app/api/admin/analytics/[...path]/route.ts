import { proxyDjango } from "@/lib/proxy-django";

async function forward(request: Request, path: string[]) {
  const url = new URL(request.url);
  const suffix = path.join("/");
  return proxyDjango(`/api/admin/analytics/${suffix}/${url.search}`);
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, path);
}
