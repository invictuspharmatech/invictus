import { requireStaff } from "@/lib/auth";
import { ComingSoonSettings } from "@/components/admin/ComingSoonSettings";

export default async function ComingSoonAdminPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">Coming soon</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Toggle the launch landing page, set the Eastern countdown time, and review users who opted
        in for the launch email.
      </p>
      <ComingSoonSettings />
    </div>
  );
}
