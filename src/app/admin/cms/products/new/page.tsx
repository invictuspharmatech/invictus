import { requireStaff } from "@/lib/auth";
import { djangoJson } from "@/lib/django";
import { ProductForm } from "@/components/admin/ProductForm";
import type { ApiCategory } from "@/lib/api-types";

export default async function NewProductPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const categories = await djangoJson<ApiCategory[]>("/api/categories/");
  return (
    <div>
      <h1 className="display-font text-3xl">New product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
