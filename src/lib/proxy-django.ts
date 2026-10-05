import { NextResponse } from "next/server";
import { DjangoError, djangoFetch, djangoJson, sessionToken } from "@/lib/django";

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

export async function proxyDjangoFile(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  try {
    const response = await djangoFetch(path, {
      ...init,
      token: await sessionToken(),
    });
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!response.ok && contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({ error: "Download failed." }));
      return NextResponse.json(
        typeof payload === "object" && payload ? payload : { error: "Download failed." },
        { status: response.status },
      );
    }
    const headers = new Headers();
    headers.set("content-type", contentType);
    const disposition = response.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new NextResponse(response.body, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "Backend unavailable." }, { status: 502 });
  }
}
