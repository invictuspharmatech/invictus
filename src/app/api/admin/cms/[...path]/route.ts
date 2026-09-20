import { proxyDjango } from "@/lib/proxy-django";

async function forward(
  request: Request,
  path: string[],
) {
  const url = new URL(request.url);
  const suffix = path.join("/");
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
  return proxyDjango(`/api/admin/cms/${suffix}/${url.search}`, {
    method: request.method,
    body,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}
