import { CmsDocument } from "@/components/site/CmsDocument";

export default function ProcessingShippingPage() {
  return (
    <CmsDocument
      slug="processing-shipping"
      fallbackTitle="Processing & Shipping"
      fallback={<p className="text-sm text-muted-foreground">Content is managed in the CMS.</p>}
    />
  );
}
