import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { OpsSettingsHub } from "@/components/admin/OpsSettingsHub";
import { SiteWideIpBlockCard } from "@/components/admin/SiteWideIpBlockCard";
import { isSuperuser } from "@/lib/roles";

export default async function AdminSettingsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Settings</h1>
      <p className="mt-4 text-sm">
        <Link href="/admin/products/import-images" className="underline underline-offset-4">
          Import products from image folder
        </Link>
      </p>
      {isSuperuser(staff.role) ? (
        <p className="mt-4 text-sm">
          <Link href="/admin/settings/btcpay" className="underline underline-offset-4">
            BTCPay / Bitcoin
          </Link>
        </p>
      ) : null}
      {isSuperuser(staff.role) ? <SiteWideIpBlockCard /> : null}
      <OpsSettingsHub />
    </div>
  );
}
