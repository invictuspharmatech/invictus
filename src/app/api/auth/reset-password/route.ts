import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    password?: string;
    passwordConfirmation?: string;
  };
  try {
    const data = await djangoJson<{ ok: boolean; token: string }>("/api/auth/reset-password/", {
      method: "POST",
      body: JSON.stringify({
        token: body.token,
        password: body.password,
        passwordConfirmation: body.passwordConfirmation,
      }),
    });
    await setSessionCookieFromToken(data.token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DjangoError) {
      return NextResponse.json(
        typeof error.payload === "object" && error.payload
          ? error.payload
          : { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Password reset service unavailable." }, { status: 502 });
  }
}
