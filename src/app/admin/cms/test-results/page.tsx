import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { TestResultManager } from "@/components/admin/TestResultManager";
import type { ApiTestResult } from "@/lib/api-types";

export default async function CmsTestResultsPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const items = await djangoAuthed<ApiTestResult[]>("/api/admin/test-results/");
  return (
    <div>
      <h1 className="display-font text-3xl">Test results</h1>
      <TestResultManager items={items} />
    </div>
  );
}
