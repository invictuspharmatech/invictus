import { PageHeader } from "@/components/site/PageHeader";

export default function CrashedGearPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Crashed Gear Protocol"
        lede="Cloudy or crystallized oils — what it means and how to fix it."
      />
      <div className="space-y-6 text-sm leading-7 text-muted-foreground">
        <section className="tile">
          <p>
            Oil-based products can arrive cloudy or with visible crystals. This is not an indication
            of poor quality. Crashing can follow cooler shipping temperatures, storage in transit,
            higher concentrations, or normal batch variability.
          </p>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">How to fix crashed oil</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Bring a pot of water to a boil.</li>
            <li>Place the vial in a sealed zip-lock bag.</li>
            <li>Remove the pot from heat.</li>
            <li>Submerge the bag for about 5 minutes.</li>
            <li>Remove with tongs and gently agitate until the solution is uniform.</li>
          </ol>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">Why this happens</h2>
          <p className="mt-3">
            Labs often use a small amount of benzyl benzoate to keep compounds in solution. Higher
            BB can prevent crashing, but excessive solvent at higher doses may raise inflammatory
            markers. Many high-quality MCT formulations use lower solvent content and may crash more
            easily. The inconvenience is often worth lower solvent exposure.
          </p>
          <p className="mt-3">
            Heat used here will not damage the active ingredients. Store oils at room temperature,
            away from light. Repeat the process as needed.
          </p>
        </section>
      </div>
    </div>
  );
}
