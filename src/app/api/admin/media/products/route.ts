import { NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/auth";
import {
  listProductMedia,
  productNameFromFilename,
  saveProductImageFile,
} from "@/lib/product-media";

export async function GET() {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return NextResponse.json({ items: listProductMedia() });
}

export async function POST(request: Request) {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No image files uploaded." }, { status: 400 });
  }

  const saved: { path: string; name: string; productName: string }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.length) {
        errors.push({ filename: file.name, error: "Empty file." });
        continue;
      }
      const item = saveProductImageFile(file.name, bytes);
      saved.push({
        ...item,
        productName: productNameFromFilename(file.name),
      });
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : "Could not save file.",
      });
    }
  }

  return NextResponse.json({ saved, errors, items: listProductMedia() });
}
