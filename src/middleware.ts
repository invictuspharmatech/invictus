import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "invictus_session";
const DJANGO = process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000";
const STAFF_ROLES = new Set(["SUPERUSER", "ADMIN", "WAREHOUSE_1", "WAREHOUSE_2"]);
const WAREHOUSE_ROLES = new Set(["WAREHOUSE_1", "WAREHOUSE_2"]);

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

/** Warehouse staff: own-warehouse orders (+ profile) only — no settings/catalog/etc. */
function warehouseStaffAllowed(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return false;
  if (pathname === "/admin/profile" || pathname.startsWith("/admin/profile/")) return true;
  if (pathname === "/admin/orders") return true;
  if (!pathname.startsWith("/admin/orders/")) return false;
  if (pathname.startsWith("/admin/orders/create")) return false;
  // Order summary + individual order pages are allowed; create is not.
  return true;
}

async function refreshedToken(current: string | undefined): Promise<{ token: string | null; rejected: boolean }> {
  if (!current) return { token: null, rejected: false };
  try {
    const res = await fetch(`${DJANGO}/api/auth/touch/`, {
      method: "POST",
      headers: { authorization: `Bearer ${current}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 401 || res.status === 403) return { token: null, rejected: true };
    if (!res.ok) return { token: current, rejected: false };
    const data = (await res.json()) as { token?: string };
    return { token: data.token || current, rejected: false };
  } catch {
    return { token: current, rejected: false };
  }
}

function applySession(response: NextResponse, token: string | null, rejected: boolean) {
  if (token) {
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
  } else if (rejected) {
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = withPathname(request);
  const current = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await refreshedToken(current);
  if (session.token) {
    requestHeaders.set("x-invictus-session", session.token);
  }

  if (pathname.startsWith("/admin")) {
    const role = await sessionRole(session.token ?? undefined);
    if (role && STAFF_ROLES.has(role)) {
      if (WAREHOUSE_ROLES.has(role) && !warehouseStaffAllowed(pathname)) {
        const response = NextResponse.redirect(new URL("/admin/orders", request.url));
        applySession(response, session.token, session.rejected);
        return response;
      }
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      applySession(response, session.token, session.rejected);
      return response;
    }
    const destination = role ? "/account" : "/login";
    const response = NextResponse.redirect(new URL(destination, request.url));
    applySession(response, session.token, session.rejected);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySession(response, session.token, session.rejected);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|media/|api/).*)"],
};
