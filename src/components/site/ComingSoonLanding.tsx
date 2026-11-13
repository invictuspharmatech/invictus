"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PromoTicker, type PromoSlide } from "@/components/site/PromoTicker";
import { bannerBgColor, bannerTextColor } from "@/lib/feature-banners";
import type { ComingSoonPublic } from "@/lib/coming-soon";
import type { BannerBgMode, BannerTextMode } from "@/lib/api-types";
import "./coming-soon.css";

function twoDigits(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function Countdown({ targetMs }: { targetMs: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, (targetMs ?? 0) - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="cs-countdown" aria-label="Countdown to launch">
      <div className="cs-unit">
        <span className="cs-num">{twoDigits(days)}</span>
        <span className="cs-lbl">Days</span>
      </div>
      <div className="cs-unit">
        <span className="cs-num">{twoDigits(hours)}</span>
        <span className="cs-lbl">Hours</span>
      </div>
      <div className="cs-unit">
        <span className="cs-num">{twoDigits(mins)}</span>
        <span className="cs-lbl">Minutes</span>
      </div>
      <div className="cs-unit">
        <span className="cs-num">{twoDigits(secs)}</span>
        <span className="cs-lbl">Seconds</span>
      </div>
    </div>
  );
}

function NotifyPanel({
  signedIn,
  buttonBg,
  buttonColor,
}: {
  signedIn: boolean;
  buttonBg: string;
  buttonColor: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const autoTried = useRef(false);
  const wantNotify = params.get("notify") === "1";
  const buttonStyle = { backgroundColor: buttonBg, color: buttonColor };

  async function optIn() {
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/auth/launch-notify", { method: "POST" });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    setPending(false);
    if (!res.ok) {
      setError(data?.error || "Could not save your launch notice request.");
      return;
    }
    setMessage(data?.message || "You will get an email when Invictus launches.");
    router.replace("/");
    router.refresh();
  }

  useEffect(() => {
    if (!signedIn || !wantNotify || autoTried.current) return;
    autoTried.current = true;
    void optIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, wantNotify]);

  function onNotify(event: FormEvent) {
    event.preventDefault();
    if (signedIn) {
      void optIn();
      return;
    }
    const next = encodeURIComponent("/?notify=1");
    router.push(`/register?notify=1&next=${next}`);
  }

  return (
    <div>
      <form className="cs-notify" onSubmit={onNotify}>
        {signedIn ? (
          <button type="submit" disabled={pending} style={buttonStyle}>
            {pending ? "Saving…" : "Notify me at launch"}
          </button>
        ) : (
          <>
            <p className="cs-auth-note">
              Create an account or sign in first — launch notices only go to registered users.
            </p>
            <button type="submit" disabled={pending} style={buttonStyle}>
              Create account to get notified
            </button>
            <Link className="cs-signin" href={`/login?next=${encodeURIComponent("/?notify=1")}`}>
              Already have an account? Sign in
            </Link>
          </>
        )}
      </form>
      {error ? <p className="cs-fine cs-error">{error}</p> : null}
      {message ? <p className="cs-fine cs-ok">{message}</p> : null}
      {!message ? <p className="cs-fine">No noise. Just the launch notice.</p> : null}
    </div>
  );
}

export function ComingSoonLanding({
  config,
  signedIn = false,
  bannerBgMode = "brand-orange",
  bannerTextMode = "light",
  bannerDisplayMode = "slider",
}: {
  config: ComingSoonPublic;
  signedIn?: boolean;
  bannerBgMode?: BannerBgMode | string;
  bannerTextMode?: BannerTextMode | string;
  bannerDisplayMode?: "marquee" | "slider";
}) {
  const launched = Boolean(config.launchAtMs && Date.now() >= config.launchAtMs);
  const accentBg = bannerBgColor(bannerBgMode);
  const accentFg = bannerTextColor(bannerTextMode);
  const promoItems: PromoSlide[] = [
    {
      id: "coming-soon-banner",
      title: launched ? "The standard is here" : config.bannerText,
      bgColorMode: bannerBgMode,
      textColorMode: bannerTextMode,
    },
  ];

  return (
    <div className="cs-root">
      <PromoTicker items={promoItems} enabled displayMode={bannerDisplayMode} />
      <div className="cs-shell">
        <div className="cs-ghost" aria-hidden>
          {config.ghostNumber}
        </div>
        <nav className="cs-nav">
          <Link className="cs-brand" href="/" aria-label="Invictus Pharma">
            <Image
              src="/images/coming-soon-logo.png"
              alt="Invictus Pharma"
              width={224}
              height={144}
              className="cs-brand-img"
              priority
            />
          </Link>
          <div className="cs-navmeta">
            <span className="cs-hide">Specimen / 001</span>
            <span className="cs-date">{config.dateMeta}</span>
          </div>
        </nav>

        <div className="cs-main">
          <section>
            <div className="cs-eyebrow">{config.eyebrow}</div>
            <h1 className="cs-title">
              <span className="cs-coming">COMING</span>
              <span className="cs-nov">{config.monthLabel}</span>
              <span className="cs-day">{config.dayLabel}.</span>
            </h1>
            <div className="cs-dek" dangerouslySetInnerHTML={{ __html: config.dek }} />
            <div className="cs-rules">
              <span>Evidence over excess</span>
              <span>Built for the long game</span>
              <span>Precision / Purpose / Progress</span>
            </div>
          </section>

          <aside className="cs-panel">
            <div className="cs-panel-label">{config.panelLabel}</div>
            <div className="cs-seal">
              <Image
                src="/images/coming-soon-seal.png"
                alt="Invictus Pharma"
                width={220}
                height={220}
                className="cs-seal-img"
                priority
              />
            </div>
            <h2
              className="cs-panel-heading"
              dangerouslySetInnerHTML={{ __html: config.panelHeading }}
            />
            <div
              className="cs-sub"
              dangerouslySetInnerHTML={{ __html: config.panelSub }}
            />
            <Countdown targetMs={config.launchAtMs} />
            <Suspense fallback={null}>
              <NotifyPanel signedIn={signedIn} buttonBg={accentBg} buttonColor={accentFg} />
            </Suspense>
            <Link className="cs-catalog" href="/products">
              Browse the Catalog
            </Link>
          </aside>
        </div>

        <div className="cs-ticker">
          <span>
            Precision / Purpose / Progress · Evidence over excess · Built for the long game · The
            standard is higher · Precision / Purpose / Progress · Evidence over excess · Built for
            the long game · The standard is higher ·
          </span>
        </div>

        <footer className="cs-footer">
          <span>
            © {new Date().getFullYear()} <b>Invictus Pharma</b>
          </span>
          <span>{config.launchDisplay} · Eastern Time</span>
        </footer>
      </div>
    </div>
  );
}
