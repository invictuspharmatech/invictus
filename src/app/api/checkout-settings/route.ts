import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";

export async function GET() {
  try {
    const data = await djangoJson("/api/checkout-settings/");
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
    return NextResponse.json({ error: "Checkout settings unavailable." }, { status: 502 });
  }
}
