import { NextResponse } from "next/server";
import { DjangoError, djangoJson } from "@/lib/django";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const data = await djangoJson("/api/cart/stock-check/", {
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
    return NextResponse.json({ error: "Could not check stock." }, { status: 502 });
  }
}
