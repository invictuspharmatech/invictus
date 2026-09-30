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

async function isStaffSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.role === "string" && STAFF_ROLES.has(payload.role);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = withPathname(request);

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!(await isStaffSession(token))) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|media/|api/).*)"],
};
