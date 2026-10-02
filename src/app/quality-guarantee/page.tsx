import { CmsDocument } from "@/components/site/CmsDocument";
import { CmsHtml } from "@/components/site/CmsHtml";
import { QUALITY_GUARANTEE_HTML } from "@/lib/policy-copy";

export default function QualityGuaranteePage() {
  return (
    <CmsDocument
      slug="quality-guarantee"
      fallbackTitle="Product Quality Guarantee"
      fallback={
        <div className="tile">
          <CmsHtml html={QUALITY_GUARANTEE_HTML} />
        </div>
      }
    />
  );
}
