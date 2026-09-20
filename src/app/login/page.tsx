"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const next = params.get("next") || "/account";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json()) as { error?: string; redirect?: string };
    if (!response.ok) {
      setError(data.error || "Sign in failed.");
      return;
    }
    router.push(data.redirect || next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="password" type="password" placeholder="Password" required />
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <button className="gold-btn w-full" type="submit">
        Sign in
      </button>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="text-foreground">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="px-4 pb-20">
      <PageHeader title="Sign in" lede="Access orders, affiliate tracking, and saved details." />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
