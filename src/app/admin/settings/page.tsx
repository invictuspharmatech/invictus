import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { OpsSettingsHub } from "@/components/admin/OpsSettingsHub";
import { isSuperuser } from "@/lib/roles";

export default async function AdminSettingsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Checkout limits, named shipping fees, sequential order numbers, and affiliate defaults.
      </p>
      {isSuperuser(staff.role) ? (
        <p className="mt-4 text-sm">
          <Link href="/admin/settings/btcpay" className="underline underline-offset-4">
            BTCPay / Bitcoin
          </Link>
          <span className="text-muted-foreground">
            {" "}
            — server URL, API key, and webhook (super user only).
          </span>
        </p>
      ) : null}
      <OpsSettingsHub />
    </div>
  );
}
