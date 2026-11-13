"use client";

import { useState } from "react";

function leaveAfterSignOut() {
  window.location.href = "/login?signed_out=1";
}

export function SignOutAllUsers() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className="ghost-btn border border-brand-red text-brand-red"
      onClick={() => {
        if (!window.confirm("Sign out every user, including you? Every current session ends and everyone must sign in again.")) {
          return;
        }
        setBusy(true);
        void fetch("/api/admin/users/logout-all", { method: "POST" })
          .then(async (response) => {
            if (!response.ok) {
              const data = (await response.json().catch(() => null)) as { error?: string } | null;
              window.alert(data?.error || "Could not sign users out.");
              setBusy(false);
              return;
            }
            leaveAfterSignOut();
          })
          .catch(() => {
            window.alert("Could not sign users out.");
            setBusy(false);
          });
      }}
    >
      {busy ? "Signing out…" : "Sign out all users"}
    </button>
  );
}

export function SignOutUserButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm text-brand-red"
      onClick={() => {
        if (!window.confirm(`Sign out ${label}? Their current sessions end and they must sign in again.`)) return;
        setBusy(true);
        void fetch(`/api/admin/users/${id}/logout`, { method: "POST" })
          .then(async (response) => {
            const data = (await response.json().catch(() => null)) as { error?: string; message?: string; logged_out_self?: boolean } | null;
            if (!response.ok) {
              window.alert(data?.error || "Could not sign that user out.");
              setBusy(false);
              return;
            }
            if (data?.logged_out_self) {
              leaveAfterSignOut();
              return;
            }
            window.alert(data?.message || "That user must sign in again.");
            setBusy(false);
          })
          .catch(() => {
            window.alert("Could not sign that user out.");
            setBusy(false);
          });
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
