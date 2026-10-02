import { CmsDocument } from "@/components/site/CmsDocument";
import { CmsHtml } from "@/components/site/CmsHtml";
import { PROCESSING_SHIPPING_HTML } from "@/lib/policy-copy";

export default function ProcessingShippingPage() {
  return (
    <CmsDocument
      slug="processing-shipping"
      fallbackTitle="Processing & Shipping"
      fallback={
        <div className="tile">
          <CmsHtml html={PROCESSING_SHIPPING_HTML} />
        </div>
      }
    />
  );
}
