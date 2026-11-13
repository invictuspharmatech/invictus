import Link from "next/link";
import { SignOutAllUsers, SignOutUserButton } from "@/components/admin/UserSessionActions";
import { requireStaff, visibleUsers } from "@/lib/auth";
import { isSuperuser, roleLabel } from "@/lib/roles";

export default async function AdminUsersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const users = await visibleUsers(staff);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create store and warehouse accounts, then assign a type.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperuser(staff.role) ? <SignOutAllUsers /> : null}
          <Link href="/admin/users/new" className="gold-btn">
            Add user
          </Link>
        </div>
      </div>
      <div className="tile mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Status</th>
              <th>Affiliate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border/40">
                <td className="py-3">{user.name}</td>
                <td>{user.email}</td>
                <td>{roleLabel(user.role)}</td>
                <td>{user.isActive ? "Active" : "Disabled"}</td>
                <td>{user.isAffiliate ? user.affiliateCode : "—"}</td>
                <td>
                  <span className="flex items-center gap-3">
                    {isSuperuser(staff.role) ? (
                      <SignOutUserButton id={user.id} label={user.name || user.email} />
                    ) : null}
                    <Link href={`/admin/users/${user.id}`} className="text-sm text-signal">
                      Edit
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
