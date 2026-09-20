import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { readSession } from "@/lib/auth";

export default async function AffiliateProgramPage() {
  const session = await readSession();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Affiliate Program"
        lede="Share Invictus with your audience. Earn on referred merchandise sales — shipping excluded. Wholesale is not part of this program."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {[
          ["Your link", "Approved affiliates receive a unique code and tracking URL."],
          ["Commission", "Default is 10% of merchandise totals, excluding shipping. Rates can be set per affiliate."],
          ["First-order courtesy", "Referred customers can receive 10% off their first merchandise total."],
        ].map(([title, copy]) => (
          <div key={title} className="tile">
            <h2 className="text-lg">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
          </div>
        ))}
      </div>
      <div className="tile mt-8">
        <h2 className="text-lg">How it works</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li>Create a customer account and apply from your dashboard.</li>
          <li>Once approved, share `?ref=YOURCODE` links. We store the referral for 60 days.</li>
          <li>When a referred customer places an order, commission is calculated on merchandise only.</li>
          <li>Track referred customers, orders, and payout status in Affiliate tracking.</li>
        </ol>
        <div className="mt-6">
          {session ? (
            <Link href={session.isAffiliate ? "/account/affiliate" : "/account"} className="gold-btn">
              {session.isAffiliate ? "Open tracking" : "Apply from your account"}
            </Link>
          ) : (
            <Link href="/register" className="gold-btn">
              Create an account to apply
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
