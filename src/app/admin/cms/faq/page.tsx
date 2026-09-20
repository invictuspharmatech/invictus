import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { FaqManager } from "@/components/admin/FaqManager";
import type { ApiFaq } from "@/lib/api-types";

export default async function CmsFaqPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const items = await djangoAuthed<ApiFaq[]>("/api/admin/cms/faq/");
  return (
    <div>
      <h1 className="display-font text-3xl">FAQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sections group on the public FAQ page by the section name.
      </p>
      <FaqManager items={items} />
    </div>
  );
}
