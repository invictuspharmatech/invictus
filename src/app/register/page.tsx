"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/admin")) {
    return "/account";
  }
  return raw;
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const notify = params.get("notify") === "1";
  const next = safeNext(params.get("next") || (notify ? "/?notify=1" : null));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const passwordConfirmation = String(form.get("passwordConfirmation") || "");
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password,
        passwordConfirmation,
        launchNotify: notify,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      verification_required?: boolean;
      message?: string;
    };
    if (!response.ok) {
      setError(data.error || "Could not create account.");
      return;
    }
    if (data.verification_required) {
      setMessage(
        data.message ||
          (notify
            ? "Check your email to verify. After verification you stay on the launch notice list."
            : "Check your email to verify this account."),
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form method="post" action="/api/auth/register" onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
      {notify ? (
        <p className="text-sm text-muted-foreground">
          Creating an account is required for the launch email notice.
        </p>
      ) : null}
      <input
        className="field"
        name="name"
        placeholder="Name"
        required
        onInput={(event) => {
          event.currentTarget.value = event.currentTarget.value
            .replace(/[^A-Za-z ]/g, "")
            .replace(/ {2,}/g, " ");
        }}
      />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input
        className="field"
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <input
        className="field"
        name="passwordConfirmation"
        type="password"
        placeholder="Confirm password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <button className="gold-btn w-full" type="submit">
        Register
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={notify ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-foreground"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="px-4 pb-20">
      <PageHeader title="Create an account" />
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
