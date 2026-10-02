import { CmsDocument } from "@/components/site/CmsDocument";
import { CmsHtml } from "@/components/site/CmsHtml";
import { TERMS_REFUNDS_HTML } from "@/lib/policy-copy";

export default function TermsRefundsPage() {
  return (
    <CmsDocument
      slug="terms-refunds"
      fallbackTitle="Terms & Refunds"
      fallback={
        <div className="tile">
          <CmsHtml html={TERMS_REFUNDS_HTML} />
        </div>
      }
    />
  );
}
