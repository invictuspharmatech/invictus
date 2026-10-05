import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { BannerManager } from "@/components/admin/BannerManager";
import { asBannerRuntime } from "@/lib/feature-banners";

export default async function CmsBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ trashed?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { trashed } = await searchParams;
  const query = trashed === "1" ? "?trashed=1" : "";
  const payload = await djangoAuthed(`/api/admin/cms/banners/${query}`);
  return (
    <Suspense>
      <BannerManager initial={asBannerRuntime(payload)} />
    </Suspense>
  );
}
