import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { BtcPaySettingsForm } from "@/components/admin/BtcPaySettingsForm";
import type { ApiBtcPaySettings } from "@/lib/api-types";
import { isSuperuser } from "@/lib/roles";

export default async function BtcPaySettingsPage() {
  const staff = await requireFullAdmin();
  if (!staff) redirect("/admin");
  if (!isSuperuser(staff.role)) redirect("/admin/settings");
  const settings = await djangoAuthed<ApiBtcPaySettings>("/api/admin/btcpay/");
  return (
    <div>
      <h1 className="display-font text-3xl">BTCPay / Bitcoin</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Super user only. Connect the primary BTCPay store (GreatLife-style authorize). Optionally add
        a second failover BTCPay — checkout uses primary first; if invoice create fails for any reason
        (including Cloudflare blocks that looked like API-key errors), it tries failover. If both
        fail, shoppers get the same error path as before.
      </p>
      <div className="mt-8">
        <BtcPaySettingsForm settings={settings} />
      </div>
    </div>
  );
}
