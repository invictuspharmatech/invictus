import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { CmsPageForm } from "@/components/admin/CmsPageForm";
import type { ApiPage } from "@/lib/api-types";

export default async function EditCmsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { id } = await params;
  const pages = await djangoAuthed<ApiPage[]>("/api/admin/cms/pages/");
  const page = pages.find((item) => item.id === id);
  if (!page) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit page</h1>
      <CmsPageForm page={page} />
    </div>
  );
}
