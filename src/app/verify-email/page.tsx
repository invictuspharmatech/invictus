"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";

function VerifyEmailForm() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Checking your verification link…");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = params.get("token") || "";
    const email = params.get("email") || "";
    if (!token || !email) {
      setMessage("This verification link is invalid.");
      return;
    }
    void fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { message?: string; error?: string };
        setOk(response.ok);
        setMessage(data.message || data.error || "Could not verify this email.");
      })
      .catch(() => setMessage("Could not verify this email."));
  }, [params]);

  return (
    <div className="tile mx-auto max-w-md space-y-4 text-sm">
      <p>{message}</p>
      {ok ? (
        <Link href="/login" className="gold-btn inline-flex">
          Sign in
        </Link>
      ) : null}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="px-4 pb-20">
      <PageHeader title="Verify email" lede="The link expires 15 minutes after it is sent." />
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
