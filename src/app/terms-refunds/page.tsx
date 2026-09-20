import { CmsDocument } from "@/components/site/CmsDocument";

export default function TermsRefundsPage() {
  return (
    <CmsDocument
      slug="terms-refunds"
      fallbackTitle="Terms & Refunds"
      fallback={<p className="text-sm text-muted-foreground">Content is managed in the CMS.</p>}
    />
  );
}
