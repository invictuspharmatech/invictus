"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Could not create account.");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="px-4 pb-20">
      <PageHeader title="Create an account" />
      <form onSubmit={onSubmit} className="tile mx-auto max-w-md space-y-4">
        <input className="field" name="name" placeholder="Name" required />
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="password" type="password" placeholder="Password" minLength={8} required />
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        <button className="gold-btn w-full" type="submit">
          Register
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
