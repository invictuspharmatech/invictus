import { requireStaff, visibleUsers } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";

export default async function AdminUsersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const users = await visibleUsers(staff);

  return (
    <div>
      <h1 className="display-font text-3xl">Users</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Super user is hidden from every other account. Customer lists from Great Life were not imported.
      </p>
      <div className="tile mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Affiliate</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border/40">
                <td className="py-3">{user.name}</td>
                <td>{user.email}</td>
                <td>{roleLabel(user.role)}</td>
                <td>{user.isAffiliate ? user.affiliateCode : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
