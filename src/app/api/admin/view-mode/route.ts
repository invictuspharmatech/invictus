import { NextResponse } from "next/server";
import { requireStaff, setUserViewCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { userView?: boolean } | null;
  const userView = Boolean(body?.userView);
  await setUserViewCookie(userView);
  return NextResponse.json({ ok: true, userView });
}
