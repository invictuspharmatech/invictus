import { NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/auth";
import { listProductMedia } from "@/lib/product-media";

export async function GET() {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return NextResponse.json({ items: listProductMedia() });
}
