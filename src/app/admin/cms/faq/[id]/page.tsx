import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { FaqForm } from "@/components/admin/FaqForm";
import type { ApiFaq } from "@/lib/api-types";

export default async function EditFaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { id } = await params;
  const payload = await djangoAuthed<ApiFaq[] | { items: ApiFaq[] }>("/api/admin/cms/faq/");
  const items = Array.isArray(payload) ? payload : payload.items ?? [];
  const item = items.find((row) => row.id === id);
  if (!item) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit FAQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">{item.question}</p>
      <FaqForm item={item} />
    </div>
  );
}
