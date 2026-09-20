import { PageHeader } from "@/components/site/PageHeader";

export default function BitcoinTutorialPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Bitcoin Tutorial / How To Pay"
        lede="From wallets to sending BTC. Click a section to jump."
      />
      <nav className="tile mb-8 text-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Contents</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Understanding wallets</li>
          <li>Getting started</li>
          <li>How to pay with Bitcoin</li>
          <li>Device setups</li>
        </ol>
      </nav>
      <div className="space-y-6 text-sm leading-7 text-muted-foreground">
        <section className="tile">
          <h2 className="text-xl text-foreground">Section 1: Understanding wallets</h2>
          <p className="mt-3">
            A bitcoin wallet is a digital application that lets you store, send, and receive
            bitcoin. Your wallet has a unique address you use to receive funds.
          </p>
          <p className="mt-3">
            Recommended beginner wallets: Cash App, Venmo, and PayPal. They handle the technical
            layer so you can focus on buying and sending.
          </p>
        </section>
        <section className="tile">
          <h2 className="text-xl text-foreground">Section 2: Getting started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Register with email, a secure password, and phone verification.</li>
            <li>Verify identity with ID, selfie, and address confirmation where required.</li>
            <li>Link a bank or card, buy bitcoin, and wait for it to settle in the wallet.</li>
          </ol>
        </section>
        <section className="tile">
          <h2 className="text-xl text-foreground">Section 3: How to pay</h2>
          <h3 className="mt-4 text-foreground">Phone with computer</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>At checkout, select Pay with BTC and wait for the QR code.</li>
            <li>Open your wallet, tap Send, scan the QR, confirm the exact amount, and send.</li>
          </ol>
          <h3 className="mt-4 text-foreground">Phone only</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Copy the bitcoin address from checkout, switch to your wallet, paste, and send the exact amount.</li>
          </ol>
          <h3 className="mt-4 text-foreground">Computer only</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Copy the address into your desktop wallet, enter the amount at the top of the QR, and confirm.</li>
          </ol>
          <p className="mt-4">
            Bitcoin transactions cannot be reversed. Double-check the amount before confirming.
          </p>
        </section>
      </div>
    </div>
  );
}
