import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";

export default async function AffiliatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireFullAdmin();
  if (!staff) redirect("/admin");
  return children;
}
