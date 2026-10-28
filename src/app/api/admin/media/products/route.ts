import { NextResponse } from "next/server";
import { requireFullAdmin } from "@/lib/auth";
import { DjangoError, djangoFetch, sessionToken } from "@/lib/django";
import { listProductMedia } from "@/lib/product-media";

/**
 * Media library for products / categories / homepage hero.
 * Uploads go to Django MEDIA_ROOT (live: ./data/media). Local public/images/products
 * are still listed so existing files remain selectable.
 */
export async function GET() {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const byPath = new Map<string, { path: string; name: string }>();

  try {
    const response = await djangoFetch("/api/admin/cms/media/", {
      token: await sessionToken(),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      items?: { path?: string; name?: string }[];
    };
    if (response.ok && Array.isArray(payload.items)) {
      for (const item of payload.items) {
        if (!item?.path) continue;
        byPath.set(item.path, {
          path: item.path,
          name: item.name || item.path.split("/").pop() || item.path,
        });
      }
    }
  } catch {
    /* fall through to local list */
  }

  for (const item of listProductMedia()) {
    if (!byPath.has(item.path)) byPath.set(item.path, item);
  }

  const items = Array.from(byPath.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const staff = await requireFullAdmin();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const incoming = await request.formData();
  const folder = String(incoming.get("folder") || "products").trim() || "products";
  const files = incoming.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No image files uploaded." }, { status: 400 });
  }

  const form = new FormData();
  form.set("folder", folder);
  for (const file of files) {
    form.append("files", file, file.name);
  }

  try {
    const response = await djangoFetch("/api/admin/cms/media/", {
      method: "POST",
      token: await sessionToken(),
      body: form,
    });
    const payload = await response.json().catch(() => ({ error: "Upload failed." }));
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
