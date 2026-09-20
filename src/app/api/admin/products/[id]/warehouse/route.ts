import { proxyDjango } from "@/lib/proxy-django";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/admin/products/${id}/warehouse/`, {
    method: "POST",
    body: "{}",
  });
}
