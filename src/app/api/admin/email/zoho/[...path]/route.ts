import { proxyDjango } from "@/lib/proxy-django";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Ctx, method: string) {
  const { path } = await context.params;
  const suffix = path.join("/");
  const url = new URL(request.url);
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  return proxyDjango(`/api/admin/email/zoho/${suffix}/${url.search}`, {
    method,
    body,
  });
}

export async function GET(request: Request, context: Ctx) {
  return forward(request, context, "GET");
}

export async function POST(request: Request, context: Ctx) {
  return forward(request, context, "POST");
}
