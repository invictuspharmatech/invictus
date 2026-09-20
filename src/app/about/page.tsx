import { CmsDocument } from "@/components/site/CmsDocument";

export default function AboutPage() {
  return (
    <CmsDocument
      slug="about"
      fallbackTitle="About Invictus Pharma"
      fallbackLede="Everything we do is rooted in a genuine passion for performance, optimization, and long-term health."
      fallback={
        <p className="text-sm text-muted-foreground">
          Content is managed in the Invictus admin CMS.
        </p>
      }
    />
  );
}
