import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "invictus_session";
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
  if (pathname.startsWith("/admin/orders/summary")) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = withPathname(request);

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const role = await sessionRole(token);
    if (role && STAFF_ROLES.has(role)) {
      if (WAREHOUSE_ROLES.has(role) && !warehouseStaffAllowed(pathname)) {
        return NextResponse.redirect(new URL("/admin/orders", request.url));
      }
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
