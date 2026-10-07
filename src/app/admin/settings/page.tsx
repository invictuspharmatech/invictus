import { requireFullAdmin } from "@/lib/auth";
import { OpsSettingsHub } from "@/components/admin/OpsSettingsHub";

export default async function AdminSettingsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Checkout limits, named shipping fees, sequential order numbers, and affiliate defaults.
      </p>
      <OpsSettingsHub />
    </div>
  );
}
