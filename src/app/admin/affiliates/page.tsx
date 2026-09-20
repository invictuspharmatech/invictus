import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { Role } from "@/lib/enums";
import { AffiliateReview } from "@/components/admin/AffiliateReview";

export default async function AdminAffiliatesPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  const applications = await djangoAuthed<
    {
      id: string;
      status: string;
      user: { id: string; email: string; name: string; role: string };
    }[]
  >("/api/admin/affiliates/");

  const visible = applications.filter((row) =>
    staff.role === Role.SUPERUSER ? true : row.user.role !== Role.SUPERUSER,
  );

  return (
    <div>
      <h1 className="display-font text-3xl">Affiliates</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Approve tracking accounts. Wholesale is not offered on this store.
      </p>
      <div className="mt-6 space-y-3">
        {visible.map((application) => (
          <article key={application.id} className="tile flex flex-wrap items-center justify-between gap-3">
            <div>
              <p>{application.user.name}</p>
              <p className="text-sm text-muted-foreground">
                {application.user.email} · {application.status}
              </p>
            </div>
            {application.status === "pending" ? (
              <AffiliateReview id={application.id} />
            ) : (
              <p className="text-sm text-muted-foreground">{application.status}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
