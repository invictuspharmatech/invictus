import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { AccountNav } from "@/components/site/AccountNav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/login?next=/account");

  return (
    <>
      <AccountNav isAffiliate={session.isAffiliate} staff={isStaff(session.role)} />
      {children}
    </>
  );
}
