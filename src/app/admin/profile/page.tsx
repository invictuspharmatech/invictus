import { requireStaff } from "@/lib/auth";
import { StaffProfileForm } from "@/components/admin/StaffProfileForm";

export default async function AdminProfilePage() {
  const staff = await requireStaff();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Update your name, email, and password for this staff account.
      </p>
      <StaffProfileForm />
    </div>
  );
}
