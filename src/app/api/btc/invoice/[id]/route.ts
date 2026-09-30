import { proxyDjango } from "@/lib/proxy-django";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyDjango(`/api/btc/invoice/${id}/`, {
    method: "POST",
    body: await request.text().then((text) => text || "{}"),
  });
}
