import { requireStaff } from "@/lib/auth";
import { MediaLibraryBrowser } from "@/components/admin/MediaLibraryBrowser";

export default async function AdminMediaLibraryPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">Media library</h1>
      <div className="tile mt-8 p-4 sm:p-6">
        <MediaLibraryBrowser mode="manage" uploadFolder="products" />
      </div>
    </div>
  );
}
