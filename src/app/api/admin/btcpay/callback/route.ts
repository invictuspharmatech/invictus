import { NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

const siteBase = () =>
  (process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );

/**
 * BTCPay posts apiKey + permissions here after Authorize app.
 * Forward to Django (state-bound, no admin cookie required), then redirect to settings.
 */
export async function POST(request: Request) {
  const incoming = new URL(request.url);
  const state = incoming.searchParams.get("state") || "";
  const contentType = request.headers.get("content-type") || "";
  let body: Record<string, unknown> = {};

  try {
    if (contentType.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      const permissions = form.getAll("permissions").length
        ? form.getAll("permissions").map(String)
        : form.getAll("permissions[]").map(String);
      body = {
        apiKey: String(form.get("apiKey") || form.get("api_key") || ""),
        userId: String(form.get("userId") || form.get("user-id") || ""),
        permissions,
      };
    }
  } catch {
    body = {};
  }

  try {
    const response = await djangoFetch(`/api/admin/btcpay/callback/?state=${encodeURIComponent(state)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as
      | { redirect?: string; error?: string; ok?: boolean }
      | null;
    const redirectPath =
      data?.redirect ||
      (response.ok
        ? "/admin/settings/btcpay?connected=1"
        : `/admin/settings/btcpay?btcpay_error=${encodeURIComponent(data?.error || "authorize_failed")}`);
    return NextResponse.redirect(new URL(redirectPath, siteBase()), 303);
  } catch {
    return NextResponse.redirect(
      new URL("/admin/settings/btcpay?btcpay_error=backend_unavailable", siteBase()),
      303,
    );
  }
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const error = incoming.searchParams.get("error") || "missing_post_callback";
  return NextResponse.redirect(
    new URL(`/admin/settings/btcpay?btcpay_error=${encodeURIComponent(error)}`, siteBase()),
    303,
  );
}
