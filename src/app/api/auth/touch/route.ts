import { NextResponse } from "next/server";
import { djangoJson, DjangoError, sessionToken } from "@/lib/django";
import { setSessionCookieFromToken, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const data = await djangoJson<{ ok: boolean; token?: string }>("/api/auth/touch/", {
      method: "POST",
      token: await sessionToken(),
    });
    if (data.token) {
      await setSessionCookieFromToken(data.token);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DjangoError && (error.status === 401 || error.status === 403)) {
      await clearSessionCookie();
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }
    return NextResponse.json({ error: "Session refresh failed." }, { status: 502 });
  }
}
