import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { readSession } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import type { ApiOrder } from "@/lib/api-types";

export default async function AccountPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/account");

  const payload = await djangoAuthed<{
    orders: ApiOrder[];
    orderCount?: number;
    lifetimeSavings?: number;
    application: { id: string; status: string } | null;
  }>("/api/account/summary/");

  return (
    <AccountDashboard
      session={session}
      staff={isStaff(session.role)}
      orders={payload.orders ?? []}
      orderCount={payload.orderCount ?? payload.orders?.length ?? 0}
      lifetimeSavings={payload.lifetimeSavings ?? 0}
      application={payload.application}
    />
  );
}
