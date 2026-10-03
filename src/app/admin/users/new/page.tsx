import { requireFullAdmin } from "@/lib/auth";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewAdminUserPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Add user</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Assign a type so the account can shop, pack orders, or manage the store.
      </p>
      <UserForm viewerRole={staff.role} />
    </div>
  );
}
