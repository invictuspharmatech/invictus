"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { Suspense } from "react";

function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/admin")) {
    return "/account";
  }
  return raw;
}

type VerifyCode = "email_unverified" | "email_unverified_pending" | "verification_locked";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Invalid email or password." : params.get("signed_out") ? "You were signed out. Sign in again." : params.get("session") === "expired" ? "You were signed out after 15 minutes without activity. Sign in again." : null,
  );
  const [verifyCode, setVerifyCode] = useState<VerifyCode | null>(null);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [resending, setResending] = useState(false);
  const next = safeReturnPath(params.get("next"));

  useEffect(() => {
    if (!params.get("email") && !params.get("password")) return;
    const clean = next && next !== "/account" ? `/login?next=${encodeURIComponent(next)}` : "/login";
    router.replace(clean);
  }, [params, next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json()) as { error?: string; redirect?: string; code?: VerifyCode };
    if (!response.ok) {
      if (
        data.code === "email_unverified" ||
        data.code === "email_unverified_pending" ||
        data.code === "verification_locked"
      ) {
        setVerifyCode(data.code);
        setCredentials({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
        });
        setError(data.error || null);
        return;
      }
      setVerifyCode(null);
      setError(data.error || "Sign in failed.");
      return;
    }
    router.push(data.redirect || next);
    router.refresh();
  }

  async function resend() {
    setResending(true);
    setError(null);
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = (await response.json()) as { error?: string; message?: string; code?: VerifyCode };
    setResending(false);
    if (data.code === "verification_locked" || data.code === "email_unverified_pending") {
      setVerifyCode(data.code);
    }
    setError(data.error || data.message || null);
  }

  if (verifyCode === "verification_locked") {
    return (
      <div className="tile mx-auto max-w-md space-y-3 text-sm">
        <p>Contact admin for account activation.</p>
      </div>
    );
  }

  if (verifyCode === "email_unverified_pending") {
    return (
      <div className="tile mx-auto max-w-md space-y-3 text-sm">
        <p>{error || "Check your email. The verification link is still valid and expires in 15 minutes."}</p>
      </div>
    );
  }

  if (verifyCode === "email_unverified") {
    return (
      <div className="tile mx-auto max-w-md space-y-3">
        <button className="gold-btn w-full" type="button" disabled={resending} onClick={() => void resend()}>
          {resending ? "Sending…" : "Send a verification token again"}
        </button>
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      </div>
    );
  }

  return (
    <form method="post" action="/api/auth/login" onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
      <input
        className="field"
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="username"
        required
      />
      <input
        className="field"
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
      />
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <button className="gold-btn w-full" type="submit">
        Sign in
      </button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="text-foreground">
          Forgot password?
        </Link>
      </p>
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
