import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { FaqList } from "@/components/admin/FaqList";
import type { ApiFaq } from "@/lib/api-types";

export default async function CmsFaqPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const payload = await djangoAuthed<ApiFaq[] | { items: ApiFaq[] }>("/api/admin/cms/faq/");
  const items = Array.isArray(payload) ? payload : payload.items ?? [];
  return <FaqList items={items} />;
}
