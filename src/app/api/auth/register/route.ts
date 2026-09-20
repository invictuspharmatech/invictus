import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djangoJson, DjangoError } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };
  const jar = await cookies();
  try {
    const data = await djangoJson<{ ok: boolean; token: string }>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        referralCode: jar.get("invictus-ref")?.value ?? null,
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
    return NextResponse.json({ error: "Registration service unavailable." }, { status: 502 });
  }
}
