import { NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

export async function POST(request: Request) {
  const raw = await request.arrayBuffer();
  const signature =
    request.headers.get("btcpay-sig") || request.headers.get("BTCPay-Sig") || "";
  const contentType = request.headers.get("content-type") || "application/json";
  const response = await djangoFetch("/api/btc/webhook/", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "btcpay-sig": signature,
    },
    body: raw,
  });
  const payload = await response.json().catch(() => ({ ok: false }));
  return NextResponse.json(payload, { status: response.status });
}
