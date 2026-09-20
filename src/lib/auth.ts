import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@/lib/enums";
import type { SessionUser } from "@/lib/types";
import { djangoAuthed } from "@/lib/django";
import { isFullAdmin, isStaff } from "@/lib/roles";

export { isStaff } from "@/lib/roles";
export type { SessionUser } from "@/lib/types";

const COOKIE = "invictus_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function readSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role as Role,
      isAffiliate: Boolean(payload.isAffiliate),
      affiliateCode:
        typeof payload.affiliateCode === "string" ? payload.affiliateCode : null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookieFromToken(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  await setSessionCookieFromToken(token);
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requireUser() {
  const session = await readSession();
  if (!session) return null;
  return session;
}

export async function requireStaff() {
  const session = await readSession();
  if (!session) return null;
  if (!isStaff(session.role)) {
    return null;
  }
  return session;
}

export async function requireFullAdmin() {
  const session = await requireStaff();
  if (!session || !isFullAdmin(session.role)) return null;
  return session;
}

export async function requireSuperuser() {
  const session = await readSession();
  if (!session || session.role !== Role.SUPERUSER) return null;
  return session;
}

export function canSeeUser(viewer: SessionUser, targetRole: Role): boolean {
  if (viewer.role === Role.SUPERUSER) return true;
  return targetRole !== Role.SUPERUSER;
}

export async function visibleUsers(_viewer: SessionUser) {
  return djangoAuthed<
    {
      id: string;
      email: string;
      name: string;
      role: string;
      isAffiliate: boolean;
      affiliateCode: string | null;
      createdAt: string;
    }[]
  >("/api/admin/users/");
}

export function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  isAffiliate: boolean;
  affiliateCode: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    isAffiliate: user.isAffiliate,
    affiliateCode: user.affiliateCode,
  };
}
