"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";

export default function ContactPage() {
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        subject: form.get("subject"),
        message: form.get("message"),
      }),
    });
    setStatus(response.ok ? "Message received. We typically reply within 24–48 hours." : "Could not send. Try again.");
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Contact Us"
        lede="Have questions or need assistance? Our team is here to help with products, orders, and protocols."
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="tile space-y-4">
          <h2 className="text-lg">Send us a message</h2>
          <input className="field" name="name" placeholder="Name" required />
          <input className="field" name="email" type="email" placeholder="Email" required />
          <input className="field" name="subject" placeholder="Subject" required />
          <textarea className="field min-h-36" name="message" placeholder="Message" required />
          <button className="gold-btn" type="submit">
            Send message
          </button>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </form>
        <div className="tile">
          <h2 className="text-lg">Dedicated support</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Our team understands the performance community and is here for product questions,
            order inquiries, or general support.
          </p>
          <p className="mt-6 text-sm">Email: support@invictuspharma.com</p>
          <p className="mt-2 text-sm text-muted-foreground">Response time: 24–48 hours on business days</p>
        </div>
      </div>
    </div>
  );
}
