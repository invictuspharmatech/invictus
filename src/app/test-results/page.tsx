import NextImage from "next/image";
import { djangoJson } from "@/lib/django";
import { PageHeader } from "@/components/site/PageHeader";
import { mediaUrl } from "@/lib/constants";
import type { ApiTestResult } from "@/lib/api-types";

export default async function TestResultsPage() {
  const results = await djangoJson<ApiTestResult[]>("/api/test-results/");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Transparency & Quality"
        title="Third-Party Test Results"
        lede="Browse third-party lab documentation. If you need a batch that is not listed, contact us."
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => {
          const src = mediaUrl(result.imagePath);
          return (
            <article key={result.id} className="tile">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {result.category}
              </p>
              <h2 className="mt-2 text-lg">{result.productName}</h2>
              <div className="relative mt-4 aspect-[4/5] bg-muted">
                {src ? (
                  <NextImage
                    src={src}
                    alt={`${result.productName} test result`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
