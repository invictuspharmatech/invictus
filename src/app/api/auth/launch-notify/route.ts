import { NextResponse } from "next/server";
import { djangoJson, DjangoError, sessionToken } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

export async function POST() {
  const token = await sessionToken();
  if (!token) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const data = await djangoJson<{
      ok: boolean;
      message?: string;
      token?: string;
      already?: boolean;
    }>("/api/auth/launch-notify/", {
      method: "POST",
      token,
      body: "{}",
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
    return NextResponse.json({ error: "Could not join launch list." }, { status: 502 });
  }
}
