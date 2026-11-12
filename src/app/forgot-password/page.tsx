"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const data = (await response.json()) as { error?: string; message?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not send reset email.");
      return;
    }
    setMessage(
      data.message ||
        "If an account exists for that email, a password reset link has been sent.",
    );
  }

  return (
    <div className="px-4 pb-20">
      <PageHeader
        title="Forgot password"
        lede="Enter the email on your account and we will send a reset link if it matches."
      />
      <form onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
        <input
          className="field"
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="username"
          required
        />
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <button className="gold-btn w-full" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="text-foreground">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
