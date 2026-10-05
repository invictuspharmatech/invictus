import { NextResponse } from "next/server";
import { djangoJson, DjangoError, sessionToken } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const data = await djangoJson<{ ok: boolean; token: string }>("/api/auth/me/password/", {
      method: "POST",
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
    return NextResponse.json({ error: "Password change failed." }, { status: 502 });
  }
}
