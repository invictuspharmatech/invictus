import { requireStaff } from "@/lib/auth";
import { FaqForm } from "@/components/admin/FaqForm";

export default async function NewFaqPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Add FAQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        New questions appear on /faq under the section name you enter.
      </p>
      <FaqForm />
    </div>
  );
}
