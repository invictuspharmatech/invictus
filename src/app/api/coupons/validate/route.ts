import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const data = await djangoJson("/api/coupons/validate/", {
      method: "POST",
      body,
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
    return NextResponse.json({ error: "Could not check that coupon." }, { status: 502 });
  }
}
