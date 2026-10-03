import { notFound } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { CategoryForm } from "@/components/admin/CategoryForm";
import type { ApiCategory } from "@/lib/api-types";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const { id } = await params;
  const category = await djangoAuthed<ApiCategory>(`/api/admin/categories/${id}/`).catch(
    () => null,
  );
  if (!category) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit category</h1>
      <CategoryForm category={category} />
    </div>
  );
}
