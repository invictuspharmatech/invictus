"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiEmailSettings } from "@/lib/api-types";

export function EmailSettingsForm({ settings }: { settings: ApiEmailSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("");

  return (
    <div className="space-y-6">
      <form
        className="tile grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSaved("");
          const form = new FormData(event.currentTarget);
          const password = String(form.get("smtpPassword") || "");
          const payload: Record<string, unknown> = {
            enabled: form.get("enabled") === "on",
            smtpHost: String(form.get("smtpHost") || ""),
            smtpPort: Number(form.get("smtpPort") || 587),
            smtpUsername: String(form.get("smtpUsername") || ""),
            useTls: form.get("useTls") === "on",
            useSsl: form.get("useSsl") === "on",
            fromEmail: String(form.get("fromEmail") || ""),
            fromName: String(form.get("fromName") || ""),
            extraAdminEmails: String(form.get("extraAdminEmails") || ""),
            warehouse1Emails: String(form.get("warehouse1Emails") || ""),
            warehouse2Emails: String(form.get("warehouse2Emails") || ""),
          };
          if (password) payload.smtpPassword = password;
          const res = await fetch("/api/admin/cms/email-settings/", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            setError("Could not save email settings.");
            return;
          }
          setSaved("Email settings saved.");
          router.refresh();
        }}
      >
        <h2 className="text-lg">SMTP and recipients</h2>
        <label className="flex items-center gap-2 text-sm">
          <input name="enabled" type="checkbox" defaultChecked={settings.enabled} />
          Enable sending (master switch)
        </label>
        <input
          className="field"
          name="smtpHost"
          placeholder="SMTP host"
          defaultValue={settings.smtpHost}
        />
        <input
          className="field max-w-32"
          name="smtpPort"
          type="number"
          placeholder="Port"
          defaultValue={settings.smtpPort}
        />
        <input
          className="field"
          name="smtpUsername"
          placeholder="SMTP username"
          defaultValue={settings.smtpUsername}
        />
        <input
          className="field"
          name="smtpPassword"
          type="password"
          placeholder={settings.hasPassword ? "Leave blank to keep current password" : "SMTP password"}
        />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input name="useTls" type="checkbox" defaultChecked={settings.useTls} />
            TLS
          </label>
          <label className="flex items-center gap-2">
            <input name="useSsl" type="checkbox" defaultChecked={settings.useSsl} />
            SSL
          </label>
        </div>
        <input
          className="field"
          name="fromName"
          placeholder="From name"
          defaultValue={settings.fromName}
        />
        <input
          className="field"
          name="fromEmail"
          type="email"
          placeholder="From email"
          defaultValue={settings.fromEmail}
        />
        <label className="grid gap-1 text-sm">
          Extra admin emails
          <textarea
            className="field min-h-20"
            name="extraAdminEmails"
            placeholder="Added to every Admin recipient list"
            defaultValue={settings.extraAdminEmails}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Warehouse 1 manager emails
          <textarea
            className="field min-h-20"
            name="warehouse1Emails"
            placeholder="Used when Warehouse manager is enabled"
            defaultValue={settings.warehouse1Emails}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Warehouse 2 manager emails
          <textarea
            className="field min-h-20"
            name="warehouse2Emails"
            placeholder="Used when Warehouse manager is enabled"
            defaultValue={settings.warehouse2Emails}
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
        <button className="gold-btn max-w-48" type="submit">
          Save settings
        </button>
      </form>
      <form
        className="tile grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setTestMessage("");
          const res = await fetch("/api/admin/cms/email-test/", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ to: testTo }),
          });
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) {
            setTestMessage(payload?.error || "Test email failed.");
            return;
          }
          setTestMessage("Test email sent.");
        }}
      >
        <h2 className="text-lg">Send a test</h2>
        <input
          className="field"
          type="email"
          placeholder="Recipient"
          value={testTo}
          onChange={(event) => setTestTo(event.target.value)}
          required
        />
        {testMessage ? <p className="text-sm text-muted-foreground">{testMessage}</p> : null}
        <button className="ghost-btn max-w-48" type="submit">
          Send test email
        </button>
      </form>
    </div>
  );
}
