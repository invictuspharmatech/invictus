import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/login?next=/account");
  return children;
}
