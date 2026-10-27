import { NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/auth";
import { DjangoError, djangoFetch, sessionToken } from "@/lib/django";

/**
 * Forward the folder upload to Django so files land in MEDIA_ROOT (./data/media on live).
 * Writing into Next public/ does not persist in Docker and is not what nginx serves.
 */
export async function POST(request: Request) {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const incoming = await request.formData();
  const categoryId = String(incoming.get("categoryId") || "").trim();
  if (!categoryId) {
    return NextResponse.json({ error: "Select a category." }, { status: 400 });
  }

  const files = incoming.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Select a folder (or files) with images." }, { status: 400 });
  }

  const form = new FormData();
  form.set("categoryId", categoryId);
  for (const file of files) {
    form.append("files", file, file.name);
  }

  try {
    const response = await djangoFetch("/api/admin/products/import-images/", {
      method: "POST",
      token: await sessionToken(),
      body: form,
    });
    const payload = await response.json().catch(() => ({ error: "Import failed." }));
    return NextResponse.json(payload, { status: response.status });
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
