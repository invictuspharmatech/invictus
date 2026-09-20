import type { ReactNode } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { CmsHtml } from "@/components/site/CmsHtml";
import { djangoJsonOptional } from "@/lib/django";
import type { ApiPage } from "@/lib/api-types";

export async function CmsDocument({
  slug,
  fallbackTitle,
  fallbackLede,
  fallback,
}: {
  slug: string;
  fallbackTitle: string;
  fallbackLede?: string;
  fallback: ReactNode;
}) {
  const page = await djangoJsonOptional<ApiPage>(`/api/cms/pages/?slug=${slug}`);
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <PageHeader title={fallbackTitle} lede={fallbackLede} />
        {fallback}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader title={page.title} lede={page.lede || fallbackLede} />
      <div className="tile">
        <CmsHtml html={page.body} />
      </div>
    </div>
  );
}
