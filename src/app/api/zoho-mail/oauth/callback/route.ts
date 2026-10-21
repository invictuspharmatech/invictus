import { NextResponse } from "next/server";
import { djangoFetch } from "@/lib/django";

/** Browser lands here after Zoho consent; forward to Django then follow its redirect. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const path = `/api/zoho-mail/oauth/callback/${incoming.search}`;
  try {
    const response = await djangoFetch(path, { redirect: "manual" });
    const location = response.headers.get("location");
    if (location) {
      return NextResponse.redirect(location);
    }
    const site = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${site.replace(/\/$/, "")}/admin/email/zoho?zoho_error=oauth_failed`);
  } catch {
    const site = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${site.replace(/\/$/, "")}/admin/email/zoho?zoho_error=backend_unavailable`);
  }
}
