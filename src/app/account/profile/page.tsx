"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MePayload = {
  name?: string;
  email?: string;
  error?: string;
};

export default function AccountProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ name, email }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setSavingProfile(false);
    if (!response.ok) {
      setProfileMessage(payload?.error || "Could not update profile.");
      return;
    }
    setProfileMessage("Profile saved.");
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
