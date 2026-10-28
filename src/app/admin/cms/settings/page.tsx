import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { SettingsForm } from "@/components/admin/SettingsForm";
import type { ApiSetting } from "@/lib/api-types";

export default async function CmsSettingsPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const items = await djangoAuthed<ApiSetting[]>("/api/admin/cms/settings/");
  return (
    <div>
      <h1 className="display-font text-3xl">Site settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Homepage logo, hero panel image, kicker, headline, and lede. Images upload to
        persistent media storage (same as products) so they work on live.
      </p>
      <SettingsForm items={items} />
    </div>
  );
}
