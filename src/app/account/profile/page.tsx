"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MePayload = {
  name?: string;
  email?: string;
  phone?: string;
  shippingLine1?: string;
  shippingLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostal?: string;
  shippingCountry?: string;
  error?: string;
};

export default function AccountProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("US");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/me");
      const payload = (await response.json().catch(() => null)) as MePayload | null;
      if (!response.ok || !payload?.email) {
        router.replace("/login?next=/account/profile");
        return;
      }
      setName(payload.name || "");
      setEmail(payload.email);
      setPhone(payload.phone || "");
      setLine1(payload.shippingLine1 || "");
      setLine2(payload.shippingLine2 || "");
      setCity(payload.shippingCity || "");
      setState(payload.shippingState || "");
      setPostal(payload.shippingPostal || "");
      setCountry(payload.shippingCountry || "US");
      setLoading(false);
    })();
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        shippingLine1: line1,
        shippingLine2: line2,
        shippingCity: city,
        shippingState: state,
        shippingPostal: postal,
        shippingCountry: country,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setSavingProfile(false);
    if (!response.ok) {
      setProfileMessage(payload?.error || "Could not update profile.");
      return;
    }
    setProfileMessage("Profile and shipping address saved.");
    router.refresh();
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    const response = await fetch("/api/auth/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        password,
        passwordConfirmation: confirm,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setSavingPassword(false);
    if (!response.ok) {
      setPasswordMessage(payload?.error || "Could not update password.");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    setPasswordMessage("Password updated.");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground sm:px-6">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">
        ← Account
      </Link>
      <h1 className="display-font mt-4 text-3xl">Edit profile</h1>

      <form onSubmit={saveProfile} className="tile mt-8 space-y-4">
        <h2 className="text-lg">Profile</h2>
        <label className="block text-sm text-muted-foreground">
          Name
          <input
            className="field mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Email
          <input
            className="field mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Phone <span className="text-muted-foreground/70">(optional)</span>
          <input
            className="field mt-1"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>

        <div className="border-t border-border/50 pt-4">
          <h2 className="text-lg">Shipping address</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved for checkout autofill when you are signed in.
          </p>
        </div>
        <label className="block text-sm text-muted-foreground">
          Address
          <input
            className="field mt-1"
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            autoComplete="shipping address-line1"
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Apartment, suite <span className="text-muted-foreground/70">(optional)</span>
          <input
            className="field mt-1"
            value={line2}
            onChange={(event) => setLine2(event.target.value)}
            autoComplete="shipping address-line2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-muted-foreground">
            City
            <input
              className="field mt-1"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              autoComplete="shipping address-level2"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            State
            <input
              className="field mt-1"
              value={state}
              onChange={(event) => setState(event.target.value)}
              autoComplete="shipping address-level1"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-muted-foreground">
            ZIP
            <input
              className="field mt-1"
              value={postal}
              onChange={(event) => setPostal(event.target.value)}
              autoComplete="shipping postal-code"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Country
            <input
              className="field mt-1"
              value={country}
              onChange={(event) => setCountry(event.target.value.toUpperCase())}
              autoComplete="shipping country"
              maxLength={8}
            />
          </label>
        </div>

        {profileMessage ? <p className="text-sm text-signal">{profileMessage}</p> : null}
        <button type="submit" className="gold-btn" disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form onSubmit={savePassword} className="tile mt-6 space-y-4">
        <h2 className="text-lg">Password</h2>
        <label className="block text-sm text-muted-foreground">
          Current password
          <input
            className="field mt-1"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          New password
          <input
            className="field mt-1"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Confirm password
          <input
            className="field mt-1"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            minLength={8}
          />
        </label>
        {passwordMessage ? <p className="text-sm text-signal">{passwordMessage}</p> : null}
        <button type="submit" className="gold-btn" disabled={savingPassword}>
          {savingPassword ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
