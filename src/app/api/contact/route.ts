import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await djangoJson("/api/contact/", {
      method: "POST",
      body: JSON.stringify(body),
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
    return NextResponse.json({ error: "Contact service unavailable." }, { status: 502 });
  }
}
