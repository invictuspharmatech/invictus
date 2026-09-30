import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { BtcPaySettingsForm } from "@/components/admin/BtcPaySettingsForm";
import type { ApiBtcPaySettings } from "@/lib/api-types";

export default async function BtcPaySettingsPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const settings = await djangoAuthed<ApiBtcPaySettings>("/api/admin/btcpay/");
  return (
    <div>
      <h1 className="display-font text-3xl">BTCPay / Bitcoin</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Link this store to your BTCPay Server. Checkout creates a payment invoice and sends the
        customer to the BTCPay page. Settled webhooks mark the order paid.
      </p>
      <div className="mt-8">
        <BtcPaySettingsForm settings={settings} />
      </div>
    </div>
  );
}
