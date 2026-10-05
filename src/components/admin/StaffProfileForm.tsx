"use client";

import { FormEvent, useEffect, useState } from "react";

export function StaffProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    (async () => {
      const response = await fetch("/api/auth/me");
      const data = (await response.json()) as { name?: string; email?: string; error?: string };
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to load profile." });
        setLoading(false);
        return;
      }
      setForm({ name: data.name ?? "", email: data.email ?? "" });
      setLoading(false);
    })();
  }, []);

  async function onProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ type: "error", text: data.error || "Failed to update profile." });
      return;
    }
    setMessage({ type: "success", text: "Profile updated." });
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    if (passwordForm.password !== passwordForm.passwordConfirmation) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/auth/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    const data = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ type: "error", text: data.error || "Failed to change password." });
      return;
    }
    setPasswordForm({ currentPassword: "", password: "", passwordConfirmation: "" });
    setShowPasswordForm(false);
    setMessage({ type: "success", text: "Password changed." });
  }

  if (loading) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading profile…</p>;
  }

  return (
    <div className="mt-6 max-w-xl space-y-6">
      {message ? (
        <p className={`text-sm ${message.type === "error" ? "text-brand-red" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      ) : null}
      <form onSubmit={onProfile} className="tile space-y-4">
        <h2 className="text-lg">Profile</h2>
        <label className="text-sm">
          Name
          <input
            className="field mt-1"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label className="text-sm">
          Email
          <input
            className="field mt-1"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </label>
        <button className="gold-btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
      <section className="tile space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Change password</h2>
          {!showPasswordForm ? (
            <button type="button" className="ghost-btn" onClick={() => setShowPasswordForm(true)}>
              Change password
            </button>
          ) : null}
        </div>
        {showPasswordForm ? (
          <form onSubmit={onPassword} className="space-y-4">
            <label className="text-sm">
              Current password
              <input
                className="field mt-1"
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              New password
              <input
                className="field mt-1"
                type="password"
                minLength={8}
                required
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              Confirm new password
              <input
                className="field mt-1"
                type="password"
                minLength={8}
                required
                value={passwordForm.passwordConfirmation}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    passwordConfirmation: event.target.value,
                  }))
                }
              />
            </label>
            <button className="gold-btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
