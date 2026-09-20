import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { BannerManager } from "@/components/admin/BannerManager";
import type { ApiBanner } from "@/lib/api-types";

export default async function CmsBannersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const items = await djangoAuthed<ApiBanner[]>("/api/admin/cms/banners/");
  return (
    <div>
      <h1 className="display-font text-3xl">Banners</h1>
      <BannerManager items={items} />
    </div>
  );
}
