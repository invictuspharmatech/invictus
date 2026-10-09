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
        Super user only. Checkout creates a Bitcoin invoice from these credentials and opens it in a
        popup. Settled webhooks mark the order paid.
      </p>
      <div className="mt-8">
        <BtcPaySettingsForm settings={settings} />
      </div>
    </div>
  );
}
