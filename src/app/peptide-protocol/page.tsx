import { PageHeader } from "@/components/site/PageHeader";

export default function PeptideProtocolPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Peptide Reconstitution Guide"
        lede="Everything you need to know about reconstituting lyophilized peptides in 3mL vials."
      />
      <div className="space-y-6 text-sm leading-7 text-muted-foreground">
        <section className="tile">
          <h2 className="text-lg text-foreground">What you&apos;ll need</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Peptide vial (3mL, lyophilized powder)</li>
            <li>Bacteriostatic water</li>
            <li>Alcohol prep pads</li>
            <li>Sterile syringe for reconstitution (3–5mL)</li>
            <li>Insulin syringes for dosing (0.3–1mL, 31g, 5/16&quot;)</li>
          </ul>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">Why bacteriostatic water?</h2>
          <p className="mt-3">
            Bacteriostatic water contains benzyl alcohol, which helps inhibit bacterial growth and
            allows multi-use over days to weeks when stored properly.
          </p>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">Step-by-step reconstitution</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Wipe both stoppers with alcohol pads.</li>
            <li>Draw 1mL, 2mL, or 3mL of bacteriostatic water.</li>
            <li>Inject slowly down the vial wall. Do not blast the powder.</li>
            <li>Gently swirl. Do not shake. Wait until clear.</li>
          </ol>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">Withdrawing your dose</h2>
          <p className="mt-3">
            3mL vials are under vacuum. Draw air equal to your dose, inject the air, invert, then
            draw. This prevents vacuum lock.
          </p>
        </section>
        <section className="tile">
          <h2 className="text-lg text-foreground">Dilution, dosing, storage</h2>
          <p className="mt-3">
            More water means easier dosing. 1mL = 100 insulin units. Use the peptide calculator for
            exact pull marks. Store reconstituted peptides at 2–8°C, out of light. Typical shelf
            life with bacteriostatic water is 2–4 weeks.
          </p>
        </section>
      </div>
    </div>
  );
}
