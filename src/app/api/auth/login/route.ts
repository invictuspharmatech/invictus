import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  try {
    const data = await djangoJson<{
      ok: boolean;
      token: string;
      redirect: string;
    }>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await setSessionCookieFromToken(data.token);
    return NextResponse.json({ ok: true, redirect: data.redirect });
  } catch (error) {
    if (error instanceof DjangoError) {
      return NextResponse.json(
        typeof error.payload === "object" && error.payload
          ? error.payload
          : { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Login service unavailable." }, { status: 502 });
  }
}
