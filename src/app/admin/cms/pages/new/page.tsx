import { requireStaff } from "@/lib/auth";
import { CmsPageForm } from "@/components/admin/CmsPageForm";

export default async function NewCmsPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">New page</h1>
      <CmsPageForm />
    </div>
  );
}
