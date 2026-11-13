import { PageHeader } from "@/components/site/PageHeader";

const section = "tile scroll-mt-28 space-y-3 text-sm leading-7 text-muted-foreground";

export default function CrashedGearPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Crashed Gear Protocol"
        lede="Cloudy or crystallized oils - what it means and how to fix it"
      />
      <nav className={`${section} mb-6`}>
        <h2 className="text-lg text-foreground">Table of contents</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><a className="text-signal" href="#cgp-intro">Crashed gear (cloudy or crystallized oils)</a></li>
          <li><a className="text-signal" href="#cgp-fix">How to fix crashed oil</a></li>
          <li><a className="text-signal" href="#cgp-why">Why this happens (and why it&apos;s not a bad thing)</a></li>
          <li><a className="text-signal" href="#cgp-notes">Important notes</a></li>
        </ul>
      </nav>
      <div className="space-y-6">
        <section id="cgp-intro" className={section}>
          <h2 className="text-lg text-foreground">Crashed Gear Protocol (Cloudy or Crystallized Oils)</h2>
          <p>
            It&apos;s not uncommon for oil-based products to arrive with a cloudy appearance or even visible crystals
            inside the vial. This is not an indication of poor quality or &quot;bad&quot; product.
          </p>
          <p className="font-medium text-foreground">Crashing can occur for several reasons, including:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Exposure to cooler temperatures during shipping</li>
            <li>Storage conditions during transit</li>
            <li>Higher concentration formulations</li>
            <li>Normal variability between batches and compounds</li>
          </ul>
        </section>
        <section id="cgp-fix" className={section}>
          <h2 className="text-lg text-foreground">How to Fix Crashed Oil</h2>
          <p>The solution is simple and safe:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Bring a pot of water to a boil</li>
            <li>Place the vial inside a sealed zip-lock bag</li>
            <li>Remove the pot from heat</li>
            <li>Submerge the sealed bag (with the vial inside) into the hot water</li>
            <li>Let it sit for approximately 5 minutes</li>
            <li>Carefully remove the bag using tongs</li>
            <li>Gently agitate (shake) the vial to ensure the solution is fully mixed</li>
          </ol>
          <p>You should see the solution return to a clear, uniform state.</p>
        </section>
        <section id="cgp-why" className={section}>
          <h2 className="text-lg text-foreground">Why This Happens (And Why It&apos;s Not a Bad Thing)</h2>
          <p>
            Reputable labs will often use a small amount of Benzyl Benzoate (BB) to help keep compounds in solution and
            reduce the likelihood of crashing.
          </p>
          <p>However, there is a balance.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Higher amounts of Benzyl Benzoate can help prevent crashing entirely</li>
            <li>
              But excessive use—especially at the higher dosing levels used by enhanced individuals—may contribute to
              elevated inflammatory markers such as C-reactive protein (CRP)
            </li>
            <li>
              Pharmaceutical-grade products often use higher levels of solvents like BB, but they are typically
              prescribed at much lower doses than what enhanced athletes use
            </li>
          </ul>
          <p>
            Many high-quality products—especially those using MCT oil as a carrier—are intentionally formulated with
            lower solvent content to improve tolerability at higher dosing levels. The tradeoff is that these products
            may be more prone to crashing under certain conditions.
          </p>
          <p>
            In that context, the occasional inconvenience of recrystallization is often outweighed by the benefit of
            lower solvent exposure, particularly for those running higher doses.
          </p>
        </section>
        <section id="cgp-notes" className={section}>
          <h2 className="text-lg text-foreground">Important Notes</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The heat used in this process will not damage the active ingredients. These compounds are typically
              exposed to similar temperatures during the manufacturing process.
            </li>
            <li>Always store oil-based products at room temperature and away from direct light.</li>
            <li>Some compounds are more prone to crashing than others and may recrystallize even with proper storage.</li>
            <li>This process can be repeated as needed without harming the product.</li>
          </ul>
          <p>
            This is a normal occurrence with properly formulated, high-concentration products and can be easily
            resolved using the steps above.
          </p>
        </section>
      </div>
    </div>
  );
}
