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
      <div className="mt-8">
        <BtcPaySettingsForm settings={settings} />
      </div>
    </div>
  );
}
