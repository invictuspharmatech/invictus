import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "invictus_session";
const STAFF_ROLES = new Set(["SUPERUSER", "ADMIN", "WAREHOUSE_1", "WAREHOUSE_2"]);

function withPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-invictus-pathname", request.nextUrl.pathname);
  return headers;
}

async function sessionRole(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = withPathname(request);

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const role = await sessionRole(token);
    if (role && STAFF_ROLES.has(role)) {
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
    const destination = role ? "/account" : "/login";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|media/|api/).*)"],
};
