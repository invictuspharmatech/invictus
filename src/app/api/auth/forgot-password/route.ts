import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  try {
    const data = await djangoJson<{ ok: boolean; message?: string }>("/api/auth/forgot-password/", {
      method: "POST",
      body: JSON.stringify({ email: body.email }),
    });
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
    return NextResponse.json({ error: "Password reset service unavailable." }, { status: 502 });
  }
}
