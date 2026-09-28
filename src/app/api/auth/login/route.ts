import { NextResponse } from "next/server";
import { djangoJson, DjangoError } from "@/lib/django";
import { setSessionCookieFromToken } from "@/lib/auth";

type LoginFields = { email?: string; password?: string };

async function readLoginFields(request: Request): Promise<{
  fields: LoginFields;
  isBrowserForm: boolean;
}> {
  const contentType = request.headers.get("content-type") || "";
  const accept = request.headers.get("accept") || "";
  const isBrowserForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (isBrowserForm) {
    const form = await request.formData();
    return {
      fields: {
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      },
      isBrowserForm: true,
    };
  }

  const body = (await request.json()) as LoginFields;
  return {
    fields: body,
    isBrowserForm: accept.includes("text/html"),
  };
}

export async function POST(request: Request) {
  try {
    const { fields, isBrowserForm } = await readLoginFields(request);
    const data = await djangoJson<{
      ok: boolean;
      token: string;
      redirect: string;
    }>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({
        email: fields.email,
        password: fields.password,
      }),
    });
    await setSessionCookieFromToken(data.token);
    if (isBrowserForm) {
      return NextResponse.redirect(new URL(data.redirect || "/account", request.url), 303);
    }
    return NextResponse.json({ ok: true, redirect: data.redirect });
  } catch (error) {
    if (error instanceof DjangoError) {
      const payload =
        typeof error.payload === "object" && error.payload
          ? error.payload
          : { error: error.message };
      const contentType = request.headers.get("content-type") || "";
      const isBrowserForm =
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data");
      if (isBrowserForm) {
        const login = new URL("/login", request.url);
        login.searchParams.set("error", "1");
        return NextResponse.redirect(login, 303);
      }
      return NextResponse.json(payload, { status: error.status });
    }
    return NextResponse.json({ error: "Login service unavailable." }, { status: 502 });
  }
}
