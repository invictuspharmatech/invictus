"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = (params.get("token") || "").trim();
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing or incomplete. Request a new one.",
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("This reset link is missing or incomplete. Request a new one.");
      return;
    }
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const passwordConfirmation = String(form.get("passwordConfirmation") || "");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password, passwordConfirmation }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Could not reset password.");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
      <input
        className="field"
        name="password"
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        minLength={8}
        required
        disabled={!token}
      />
      <input
        className="field"
        name="passwordConfirmation"
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        minLength={8}
        required
        disabled={!token}
      />
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <button className="gold-btn w-full" type="submit" disabled={pending || !token}>
        {pending ? "Saving…" : "Set new password"}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Need a new link?{" "}
        <Link href="/forgot-password" className="text-foreground">
          Request reset
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="px-4 pb-20">
      <PageHeader title="Reset password" lede="Choose a new password for your account." />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
