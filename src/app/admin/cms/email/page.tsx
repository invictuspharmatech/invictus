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
      <h1 className="display-font text-3xl">Email settings & templates</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Separate SMTP for transactional mail and bulk campaigns, plus the
        branded layout and notification copy. Bulk sending lives on the Email
        tab.
      </p>
      <div className="mt-8">
        <EmailSettingsForm settings={settings} />
        <EmailTemplateManager items={templates} />
      </div>
    </div>
  );
}
