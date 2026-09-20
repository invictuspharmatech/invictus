import { NextResponse } from "next/server";
import { DjangoError, djangoJson, sessionToken } from "@/lib/django";

export async function proxyDjango(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  try {
    const data = await djangoJson(path, {
      ...init,
      token: await sessionToken(),
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
    return NextResponse.json({ error: "Backend unavailable." }, { status: 502 });
  }
}
