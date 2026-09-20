import { CmsDocument } from "@/components/site/CmsDocument";

export default function QualityGuaranteePage() {
  return (
    <CmsDocument
      slug="quality-guarantee"
      fallbackTitle="Product Quality Guarantee"
      fallback={<p className="text-sm text-muted-foreground">Content is managed in the CMS.</p>}
    />
  );
}
