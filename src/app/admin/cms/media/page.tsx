import { requireStaff } from "@/lib/auth";
import { MediaLibraryBrowser } from "@/components/admin/MediaLibraryBrowser";

export default async function AdminMediaLibraryPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">Media library</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Bulk-upload images into persistent media storage, then assign them later from any product,
        category, or homepage image picker. Filter by folder, search by filename, and sort by upload
        date or name.
      </p>
      <div className="tile mt-8 p-4 sm:p-6">
        <MediaLibraryBrowser mode="manage" uploadFolder="products" />
      </div>
    </div>
  );
}
