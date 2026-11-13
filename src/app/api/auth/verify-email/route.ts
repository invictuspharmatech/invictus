import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";

export async function POST(request: Request) {
  try {
    const data = await djangoJson("/api/auth/verify-email/", {
      method: "POST",
      body: await request.text(),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DjangoError) {
      return NextResponse.json(
        typeof error.payload === "object" && error.payload ? error.payload : { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Verification service unavailable." }, { status: 502 });
  }
}
