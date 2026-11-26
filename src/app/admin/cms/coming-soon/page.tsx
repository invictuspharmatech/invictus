import { requireStaff } from "@/lib/auth";
import { ComingSoonSettings } from "@/components/admin/ComingSoonSettings";

export default async function ComingSoonAdminPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <h1 className="display-font text-3xl">Coming soon</h1>
      <ComingSoonSettings />
    </div>
  );
}
