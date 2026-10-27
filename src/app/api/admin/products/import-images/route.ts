import { NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/auth";
import { DjangoError, djangoJson, sessionToken } from "@/lib/django";
import {
  productNameFromFilename,
  saveProductImageFile,
} from "@/lib/product-media";

export async function POST(request: Request) {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await request.formData();
  const categoryId = String(form.get("categoryId") || "").trim();
  if (!categoryId) {
    return NextResponse.json({ error: "Select a category." }, { status: 400 });
  }

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Select a folder (or files) with images." }, { status: 400 });
  }

  const items: { name: string; image: string; filename: string }[] = [];
  const uploadErrors: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.length) {
        uploadErrors.push({ filename: file.name, error: "Empty file." });
        continue;
      }
      const saved = saveProductImageFile(file.name, bytes);
      items.push({
        name: productNameFromFilename(file.name),
        image: saved.path,
        filename: file.name,
      });
    } catch (error) {
      uploadErrors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : "Could not save file.",
      });
    }
  }

  if (!items.length) {
    return NextResponse.json(
      { error: "No images could be saved.", uploadErrors },
      { status: 400 },
    );
  }

  try {
    const result = await djangoJson<{
      created: number;
      updated: number;
      errors: number;
      categoryName: string;
      results: Array<{
        action: string;
        id?: string;
        name?: string;
        sku?: string;
        image?: string;
        error?: string;
      }>;
    }>("/api/admin/products/import-images/", {
      method: "POST",
      token: await sessionToken(),
      body: JSON.stringify({ categoryId, items }),
    });
    return NextResponse.json({ ...result, uploadErrors, uploaded: items.length });
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
