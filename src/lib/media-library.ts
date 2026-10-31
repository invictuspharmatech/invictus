export type MediaLibraryItem = {
  path: string;
  name: string;
  folder?: string;
  uploadedAt?: string | null;
};

export type MediaSort = "newest" | "oldest" | "name_asc" | "name_desc";
export type MediaFolderFilter = "all" | "products" | "site";

export function filterAndSortMedia(
  items: MediaLibraryItem[],
  {
    query = "",
    folder = "all",
    sort = "newest",
  }: {
    query?: string;
    folder?: MediaFolderFilter;
    sort?: MediaSort;
  },
): MediaLibraryItem[] {
  const q = query.trim().toLowerCase();
  let next = items.filter((item) => {
    if (folder !== "all" && (item.folder || "products") !== folder) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    );
  });

  next = [...next].sort((a, b) => {
    switch (sort) {
      case "oldest": {
        const aAt = a.uploadedAt || "";
        const bAt = b.uploadedAt || "";
        if (aAt !== bAt) return aAt.localeCompare(bAt);
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      case "name_asc":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "name_desc":
        return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
      case "newest": {
        const aAt = a.uploadedAt || "";
        const bAt = b.uploadedAt || "";
        if (aAt !== bAt) return bAt.localeCompare(aAt);
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      default: {
        const exhaustive: never = sort;
        return exhaustive;
      }
    }
  });

  return next;
}

export function formatMediaUploadedAt(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
