import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { djangoAuthed, djangoJson } from "@/lib/django";
import { ProductForm } from "@/components/admin/ProductForm";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { id } = await params;
  const [product, categories] = await Promise.all([
    djangoAuthed<ApiProduct>(`/api/admin/products/${id}/`),
    djangoJson<ApiCategory[]>("/api/categories/"),
  ]);
  if (!product?.id) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit product</h1>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
