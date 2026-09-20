import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { EmailSettingsForm } from "@/components/admin/EmailSettingsForm";
import { EmailTemplateManager } from "@/components/admin/EmailTemplateManager";
import type { ApiEmailSettings, ApiEmailTemplate } from "@/lib/api-types";

export default async function CmsEmailPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const [settings, templates] = await Promise.all([
    djangoAuthed<ApiEmailSettings>("/api/admin/cms/email-settings/"),
    djangoAuthed<ApiEmailTemplate[]>("/api/admin/cms/email-templates/"),
  ]);

  return (
    <div>
      <h1 className="display-font text-3xl">Email & notifications</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Configure SMTP here, then turn each notification on or off and choose who
        receives it: admin, the customer, warehouse managers, a custom list, or both
        admin and customer by checking both boxes.
      </p>
      <div className="mt-8">
        <EmailSettingsForm settings={settings} />
        <EmailTemplateManager items={templates} />
      </div>
    </div>
  );
}
