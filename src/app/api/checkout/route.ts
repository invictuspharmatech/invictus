import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djangoJson, DjangoError, sessionToken } from "@/lib/django";

export async function POST(request: Request) {
  const body = await request.json();
  const jar = await cookies();
  const referral = body.referralCode || jar.get("invictus-ref")?.value || null;
  try {
    const data = await djangoJson("/api/checkout/", {
      method: "POST",
      token: await sessionToken(),
      body: JSON.stringify({ ...body, referralCode: referral }),
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
    return NextResponse.json({ error: "Checkout service unavailable." }, { status: 502 });
  }
}
