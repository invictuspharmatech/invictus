import { requireFullAdmin } from "@/lib/auth";
import { CategoryForm } from "@/components/admin/CategoryForm";

export default async function NewCategoryPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Add category</h1>
      <CategoryForm />
    </div>
  );
}
