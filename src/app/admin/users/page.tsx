import Link from "next/link";
import { SignOutAllUsers } from "@/components/admin/UserSessionActions";
import { UsersBoard } from "@/components/admin/UsersBoard";
import { requireStaff } from "@/lib/auth";
import { isFullAdmin, isSuperuser } from "@/lib/roles";

export default async function AdminUsersPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search by name or email, then filter by role and status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperuser(staff.role) ? <SignOutAllUsers /> : null}
          {isFullAdmin(staff.role) ? (
            <Link href="/admin/users/blocked-domains" className="ghost-btn">
              Blocked domains
            </Link>
          ) : null}
          <Link href="/admin/users/new" className="gold-btn">
            Add user
          </Link>
        </div>
      </div>
      <UsersBoard viewerRole={staff.role} />
    </div>
  );
}
