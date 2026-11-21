"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

type Account = { name: string; email: string };

const CHAR_TIP =
  "Do not use HTML characters such as < or >. Plain text is fine — apostrophes, question marks, and quotes are allowed. After two warnings, a third attempt can block this network (temporary or until staff remove it, per site settings).";

export default function ContactPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "error">("ok");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: { name?: string; email?: string } | null) => {
        if (data?.email) {
          setAccount({ name: data.name || "", email: data.email });
          setName(data.name || "");
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setStatusTone("ok");
    const response = await fetch("/api/contact", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, subject, message }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      strikes?: number;
      blocked?: boolean;
      blockMinutes?: number;
      remainingSeconds?: number;
    } | null;
    if (!response.ok) {
      const messageText = data?.error || "Could not send. Try again.";
      const strikes = Number(data?.strikes) || 0;
      if (data?.blocked) {
        setStatusTone("error");
        window.alert(messageText);
      } else if (strikes >= 2) {
        setStatusTone("warn");
        window.alert(messageText);
      } else if (strikes >= 1) {
        setStatusTone("warn");
      } else {
        setStatusTone("error");
      }
      setStatus(messageText);
      return;
    }
    setSubject("");
    setMessage("");
    setStatusTone("ok");
    setStatus("Message received. We typically reply within 24–48 hours.");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Contact Us"
        lede="Have questions or need assistance? Our team is here to help with products, orders, and protocols."
      />
      <div className="grid gap-8 lg:grid-cols-2">
        {!ready ? (
          <div className="tile text-sm text-muted-foreground">Loading…</div>
        ) : !account ? (
          <div className="tile space-y-4">
            <h2 className="text-lg">Sign in to send a message</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              The contact form is available to registered accounts. The message is sent from the email on your account.
            </p>
            <Link href="/login?next=/contact" className="gold-btn inline-flex">
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="tile space-y-4">
            <h2 className="text-lg">Send us a message</h2>
            <p className="text-sm leading-6 text-muted-foreground">{CHAR_TIP}</p>
            <input
              className="field"
              name="name"
              placeholder="Name"
              required
              value={name}
              onChange={(event) =>
                setName(event.target.value.replace(/[^A-Za-z ]/g, "").replace(/ {2,}/g, " "))
              }
            />
            <input className="field" value={account.email} readOnly aria-label="Account email" />
            <input
              className="field"
              name="subject"
              placeholder="Subject"
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <textarea
              className="field min-h-36"
              name="message"
              placeholder="Message"
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button className="gold-btn" type="submit">
              Send message
            </button>
            {status ? (
              <p
                className={`text-sm ${
                  statusTone === "ok"
                    ? "text-muted-foreground"
                    : statusTone === "warn"
                      ? "text-signal"
                      : "text-brand-red"
                }`}
              >
                {status}
              </p>
            ) : null}
          </form>
        )}
        <div className="tile">
          <h2 className="text-lg">Dedicated support</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Our team understands the performance community and is here for product questions,
            order inquiries, or general support.
          </p>
          <p className="mt-6 text-sm">Email: admin@invictuspharma.net</p>
          <p className="mt-2 text-sm text-muted-foreground">Response time: 24–48 hours on business days</p>
        </div>
      </div>
    </div>
  );
}
