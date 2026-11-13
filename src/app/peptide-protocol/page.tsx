import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

const section = "tile scroll-mt-28 space-y-3 text-sm leading-7 text-muted-foreground";

export default function PeptideProtocolPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Peptide Reconstitution Guide"
        lede="Everything you need to know about peptides"
      />
      <nav className={`${section} mb-6`}>
        <h2 className="text-lg text-foreground">Table of contents</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><a className="text-signal" href="#pp-intro">Peptide Reconstitution Guide (3mL vials)</a></li>
          <li><a className="text-signal" href="#pp-need">What you&apos;ll need</a></li>
          <li><a className="text-signal" href="#pp-bac-water">Why bacteriostatic water?</a></li>
          <li><a className="text-signal" href="#pp-recon-steps">Step-by-step reconstitution</a></li>
          <li><a className="text-signal" href="#pp-vacuum">Withdrawing your dose (vacuum tip)</a></li>
          <li><a className="text-signal" href="#pp-dilution">Choosing your dilution</a></li>
          <li><a className="text-signal" href="#pp-dosing-basics">Dosing basics</a></li>
          <li><a className="text-signal" href="#pp-storage">Storage guidelines</a></li>
          <li><a className="text-signal" href="#pp-shelf">Shelf life</a></li>
          <li><a className="text-signal" href="#pp-best">Best practices</a></li>
          <li><a className="text-signal" href="#pp-trouble">Troubleshooting</a></li>
        </ul>
      </nav>
      <div className="space-y-6">
        <section id="pp-intro" className={section}>
          <h2 className="text-lg text-foreground">Peptide Reconstitution Guide (3mL Vials)</h2>
          <p>
            Lyophilized (freeze-dried) peptides are supplied as a powder and must be reconstituted with a sterile
            diluent before use. Proper reconstitution ensures accuracy, stability, and ease of dosing.
          </p>
        </section>
        <section id="pp-need" className={section}>
          <h2 className="text-lg text-foreground">What You&apos;ll Need</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Peptide vial (3mL vial, lyophilized powder)</li>
            <li>Bacteriostatic water (preferred)</li>
            <li>Alcohol prep pads</li>
            <li>Sterile syringe for reconstitution (3–5mL recommended)</li>
            <li>Insulin syringes for dosing (0.3mL to 1mL, 31 gauge, 5/16&quot; for subcutaneous injection preferred)</li>
          </ul>
        </section>
        <section id="pp-bac-water" className={section}>
          <h2 className="text-lg text-foreground">Why Bacteriostatic Water?</h2>
          <p>
            Bacteriostatic water contains a small amount of benzyl alcohol, which helps inhibit bacterial growth and
            allows the solution to be used multiple times over a period of days to weeks when stored properly.
          </p>
        </section>
        <section id="pp-recon-steps" className={section}>
          <h2 className="text-lg text-foreground">Step-by-Step Reconstitution</h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="font-medium text-foreground">Sanitize. </span>
              Wipe the rubber stoppers of both the peptide vial and the bacteriostatic water vial with alcohol pads.
            </li>
            <li>
              <span className="font-medium text-foreground">Draw Diluent. </span>
              Using a sterile syringe, draw your desired amount of bacteriostatic water (commonly 1mL, 2mL, or 3mL
              depending on your preferred concentration).
            </li>
            <li>
              <span className="font-medium text-foreground">Inject Slowly. </span>
              Insert the needle into the peptide vial and slowly inject the water down the inside wall of the vial.
              Do not blast the powder directly—this can damage delicate peptide chains.
            </li>
            <li>
              <span className="font-medium text-foreground">Dissolve Gently. </span>
              Allow the vial to sit for a few minutes. If needed, gently swirl (do not shake) until the solution is
              fully dissolved and clear.
            </li>
          </ol>
        </section>
        <section id="pp-vacuum" className={section}>
          <h2 className="text-lg text-foreground">Withdrawing Your Dose (Vacuum Tip)</h2>
          <p>3mL vials are sealed under vacuum, which can create resistance when drawing liquid out.</p>
          <p className="font-medium text-foreground">To make withdrawal easier and more accurate:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Pull back your insulin syringe to draw in air equal to your intended dose</li>
            <li>Insert the needle into the vial</li>
            <li>Inject the air into the vial to equalize pressure</li>
            <li>Turn the vial upside down</li>
            <li>Slowly draw your desired dose</li>
          </ol>
          <p>This prevents vacuum lock, improves accuracy, and makes the draw smoother.</p>
        </section>
        <section id="pp-dilution" className={section}>
          <h2 className="text-lg text-foreground">Choosing Your Dilution</h2>
          <p>The amount of water you add determines how easy it is to measure your dose.</p>
          <p className="font-medium text-foreground">Example (5mg peptide in a 3mL vial):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>1mL added = higher concentration (more potent per unit, smaller injections)</li>
            <li>2mL added = moderate concentration</li>
            <li>3mL added = lower concentration (easier, more precise dosing)</li>
          </ul>
          <p className="font-medium text-foreground">General rule:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>More water = easier dosing</li>
            <li>Less water = smaller injection volume</li>
          </ul>
        </section>
        <section id="pp-dosing-basics" className={section}>
          <h2 className="text-lg text-foreground">Dosing Basics</h2>
          <p>Insulin syringes are typically marked in &quot;units&quot; (0–100):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>1mL = 100 units</li>
            <li>0.1mL = 10 units</li>
            <li>0.01mL = 1 unit</li>
          </ul>
          <p>
            Using 0.3mL, 0.5mL, or 1mL 31g 5/16&quot; insulin syringes allows for precise, low-volume subcutaneous
            injections with minimal discomfort.
          </p>
          <p className="font-medium text-foreground">Your dose depends on:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Total peptide amount (mg)</li>
            <li>Total water added (mL)</li>
          </ul>
          <p>
            Because of this, using a <Link className="text-signal" href="/peptide-calculator">peptide calculator</Link> is
            highly recommended for accuracy.
          </p>
        </section>
        <section id="pp-storage" className={section}>
          <h2 className="text-lg text-foreground">Storage Guidelines</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Store reconstituted peptides in the refrigerator (2–8°C / 36–46°F)</li>
            <li>Keep vials out of direct light</li>
            <li>Avoid repeated temperature fluctuations</li>
            <li>Do not freeze after reconstitution unless specifically known to be stable</li>
          </ul>
        </section>
        <section id="pp-shelf" className={section}>
          <h2 className="text-lg text-foreground">Shelf Life</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Reconstituted peptides typically remain stable for 2–4 weeks when using bacteriostatic water</li>
            <li>If using sterile water (no preservative), use within 24–48 hours</li>
          </ul>
        </section>
        <section id="pp-best" className={section}>
          <h2 className="text-lg text-foreground">Best Practices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Always use sterile technique</li>
            <li>Do not reuse needles</li>
            <li>Avoid touching the vial stopper after sanitizing</li>
            <li>If the solution becomes cloudy, discolored, or develops particles, discard it</li>
          </ul>
        </section>
        <section id="pp-trouble" className={section}>
          <h2 className="text-lg text-foreground">Troubleshooting</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Foaming or bubbles: Let the vial sit until it settles</li>
            <li>Powder won&apos;t dissolve: Allow more time and gently swirl</li>
            <li>Difficulty drawing solution: Add air to equalize pressure (see above)</li>
            <li>Accidental shaking: Usually not an issue, but avoid making it a habit</li>
          </ul>
          <p>
            Proper reconstitution is critical for getting consistent, reliable results. Take your time, stay sterile,
            and always double-check your measurements.
          </p>
        </section>
      </div>
    </div>
  );
}
