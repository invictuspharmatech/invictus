import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { FooterTelegramCard } from "@/components/admin/FooterTelegramCard";
import type { ApiSetting } from "@/lib/api-types";

export default async function CmsSettingsPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const items = await djangoAuthed<ApiSetting[]>("/api/admin/cms/settings/");
  return (
    <div>
      <h1 className="display-font text-3xl">Site settings</h1>
      <SettingsForm items={items} />
      <FooterTelegramCard />
    </div>
  );
}
