import { notFound } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { UserForm } from "@/components/admin/UserForm";
import type { ApiAdminUser } from "@/lib/api-types";

export default async function EditAdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const { id } = await params;
  const user = await djangoAuthed<ApiAdminUser>(`/api/admin/users/${id}/`).catch(() => null);
  if (!user) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit user</h1>
      <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
      <UserForm user={user} viewerRole={staff.role} />
    </div>
  );
}
