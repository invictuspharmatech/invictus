import { readdirSync, statSync } from "fs";
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
