import { NextResponse } from "next/server";
import { djangoJson, DjangoError, sessionToken } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";
import { proxyDjango } from "@/lib/proxy-django";

export async function GET() {
  return proxyDjango("/api/auth/me/");
}

export async function PATCH(request: Request) {
  try {
    const data = await djangoJson<{ ok: boolean; token: string }>("/api/auth/me/", {
      method: "PATCH",
      token: await sessionToken(),
      body: await request.text(),
    });
    if (data.token) {
      await setSessionCookieFromToken(data.token);
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DjangoError) {
      return NextResponse.json(
        typeof error.payload === "object" && error.payload
          ? error.payload
          : { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Profile update failed." }, { status: 502 });
  }
}
