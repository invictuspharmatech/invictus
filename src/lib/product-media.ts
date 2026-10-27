import { mkdirSync, readdirSync, statSync, writeFileSync } from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const PRODUCT_MEDIA_DIR = "/images/products";

export type ProductMediaItem = {
  path: string;
  name: string;
};

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export function productMediaRoot(): string {
  return path.join(process.cwd(), "public", "images", "products");
}

export function ensureProductMediaDir(): string {
  const dir = productMediaRoot();
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Safe on-disk filename; keeps extension. */
export function sanitizeProductImageFilename(filename: string): string {
  const base = path.basename(filename || "image.png");
  const ext = path.extname(base).toLowerCase() || ".png";
  const stem = path.basename(base, path.extname(base)) || "image";
  const cleaned = stem
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${cleaned || "image"}${IMAGE_EXTENSIONS.has(ext) ? ext : ".png"}`;
}

export function saveProductImageFile(filename: string, bytes: Buffer): ProductMediaItem {
  const dir = ensureProductMediaDir();
  let name = sanitizeProductImageFilename(filename);
  let target = path.join(dir, name);
  if (!IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    throw new Error(`Unsupported image type: ${filename}`);
  }
  // Avoid clobbering unrelated files with the same sanitized name.
  if (statSyncSafe(target)) {
    const ext = path.extname(name);
    const stem = path.basename(name, ext);
    let n = 2;
    while (statSyncSafe(path.join(dir, `${stem}-${n}${ext}`))) {
      n += 1;
    }
    name = `${stem}-${n}${ext}`;
    target = path.join(dir, name);
  }
  writeFileSync(target, bytes);
  return { path: `${PRODUCT_MEDIA_DIR}/${name}`, name };
}

function statSyncSafe(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function productNameFromFilename(filename: string): string {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function listProductMedia(): ProductMediaItem[] {
  const dir = productMediaRoot();
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => {
      if (name.startsWith(".")) return false;
      if (!isImageFile(name)) return false;
      try {
        return statSync(path.join(dir, name)).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((name) => ({
      path: `${PRODUCT_MEDIA_DIR}/${name}`,
      name,
    }));
}
