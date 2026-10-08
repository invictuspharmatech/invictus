"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ApiEmailSettings } from "@/lib/api-types";

type Encryption = "tls" | "ssl" | "none";

function encryptionFromFlags(useTls: boolean, useSsl: boolean): Encryption {
  if (useSsl) return "ssl";
  if (useTls) return "tls";
  return "none";
}

function flagsFromEncryption(value: Encryption) {
  return {
    useTls: value === "tls",
    useSsl: value === "ssl",
  };
}

export function EmailSettingsForm({ settings }: { settings: ApiEmailSettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost);
  const [smtpPort, setSmtpPort] = useState(String(settings.smtpPort || 587));
  const [smtpUsername, setSmtpUsername] = useState(settings.smtpUsername);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpEncryption, setSmtpEncryption] = useState<Encryption>(
    encryptionFromFlags(settings.useTls, settings.useSsl),
  );
  const [fromEmail, setFromEmail] = useState(settings.fromEmail);
  const [fromName, setFromName] = useState(settings.fromName);
  const [bulkSmtpHost, setBulkSmtpHost] = useState(settings.bulkSmtpHost);
  const [bulkSmtpPort, setBulkSmtpPort] = useState(String(settings.bulkSmtpPort || 2525));
  const [bulkSmtpUsername, setBulkSmtpUsername] = useState(settings.bulkSmtpUsername);
  const [bulkSmtpPassword, setBulkSmtpPassword] = useState("");
  const [bulkSmtpEncryption, setBulkSmtpEncryption] = useState<Encryption>(
    encryptionFromFlags(settings.bulkUseTls, settings.bulkUseSsl),
  );
  const [bulkFromEmail, setBulkFromEmail] = useState(settings.bulkFromEmail);
  const [bulkFromName, setBulkFromName] = useState(settings.bulkFromName);
  const [fallbackTransactionalToBulk, setFallbackTransactionalToBulk] = useState(
    settings.fallbackTransactionalToBulk,
  );
  const [extraAdminEmails, setExtraAdminEmails] = useState(settings.extraAdminEmails);
  const [warehouse1Emails, setWarehouse1Emails] = useState(settings.warehouse1Emails);
  const [warehouse2Emails, setWarehouse2Emails] = useState(settings.warehouse2Emails);
  const [wrapperHtml, setWrapperHtml] = useState(settings.wrapperHtml);
  const [testTo, setTestTo] = useState("");
  const [testChannel, setTestChannel] = useState<"transactional" | "bulk">("transactional");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    setWrapperHtml(settings.wrapperHtml);
    setFallbackTransactionalToBulk(settings.fallbackTransactionalToBulk);
  }, [settings.wrapperHtml, settings.fallbackTransactionalToBulk]);

  return (
    <div className="space-y-6">
      <form
        className="space-y-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSaved("");
          const transactional = flagsFromEncryption(smtpEncryption);
          const bulk = flagsFromEncryption(bulkSmtpEncryption);
          const payload: Record<string, unknown> = {
            enabled,
            smtpHost,
            smtpPort: Number(smtpPort) || 587,
            smtpUsername,
            useTls: transactional.useTls,
            useSsl: transactional.useSsl,
            fromEmail,
            fromName,
            bulkSmtpHost,
            bulkSmtpPort: Number(bulkSmtpPort) || 2525,
            bulkSmtpUsername,
            bulkUseTls: bulk.useTls,
            bulkUseSsl: bulk.useSsl,
            bulkFromEmail,
            bulkFromName,
            fallbackTransactionalToBulk,
            extraAdminEmails,
            warehouse1Emails,
            warehouse2Emails,
            wrapperHtml,
          };
          if (smtpPassword) payload.smtpPassword = smtpPassword;
          if (bulkSmtpPassword) payload.bulkSmtpPassword = bulkSmtpPassword;
          const res = await fetch("/api/admin/cms/email-settings/", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            setError("Could not save email settings.");
            return;
          }
          setSmtpPassword("");
          setBulkSmtpPassword("");
          setSaved("Email settings saved.");
          router.refresh();
        }}
      >
        <section className="tile grid gap-3">
          <h2 className="text-lg">Transactional SMTP</h2>
          <p className="text-sm text-muted-foreground">
            Used for order confirmations, payment, shipping, accounts, and other
            store mail. Leave a password blank to keep the saved one.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enable sending (master switch)
          </label>
          <label className="grid gap-1 text-sm">
            SMTP host
            <input
              className="field"
              placeholder="smtp.zoho.com"
              value={smtpHost}
              onChange={(event) => setSmtpHost(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Port
              <input
                className="field"
                type="number"
                min={1}
                max={65535}
                value={smtpPort}
                onChange={(event) => setSmtpPort(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Encryption
              <select
                className="field"
                value={smtpEncryption}
                onChange={(event) => setSmtpEncryption(event.target.value as Encryption)}
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Username
            <input
              className="field"
              value={smtpUsername}
              onChange={(event) => setSmtpUsername(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Password
            <input
              className="field"
              type="password"
              value={smtpPassword}
              onChange={(event) => setSmtpPassword(event.target.value)}
              placeholder={
                settings.hasPassword ? "•••••••• (enter new to replace)" : "SMTP password"
              }
              autoComplete="new-password"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              From email
              <input
                className="field"
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              From name
              <input
                className="field"
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="tile grid gap-3">
          <h2 className="text-lg">Bulk mail SMTP</h2>
          <p className="text-sm text-muted-foreground">
            Used only for admin bulk email. Order and account mail keep using
            transactional SMTP unless the fallback switch below is on.
          </p>
          <label className="grid gap-1 text-sm">
            SMTP host
            <input
              className="field"
              placeholder="smtp.elasticemail.com"
              value={bulkSmtpHost}
              onChange={(event) => setBulkSmtpHost(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Port
              <input
                className="field"
                type="number"
                min={1}
                max={65535}
                value={bulkSmtpPort}
                onChange={(event) => setBulkSmtpPort(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Encryption
              <select
                className="field"
                value={bulkSmtpEncryption}
                onChange={(event) => setBulkSmtpEncryption(event.target.value as Encryption)}
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Username
            <input
              className="field"
              value={bulkSmtpUsername}
              onChange={(event) => setBulkSmtpUsername(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Password / API key
            <input
              className="field"
              type="password"
              value={bulkSmtpPassword}
              onChange={(event) => setBulkSmtpPassword(event.target.value)}
              placeholder={
                settings.hasBulkPassword
                  ? "•••••••• (enter new to replace)"
                  : "Bulk SMTP password"
              }
              autoComplete="new-password"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              From email
              <input
                className="field"
                type="email"
                value={bulkFromEmail}
                onChange={(event) => setBulkFromEmail(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              From name
              <input
                className="field"
                value={bulkFromName}
                onChange={(event) => setBulkFromName(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="tile grid gap-3">
          <h2 className="text-lg">Transactional fallback</h2>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={fallbackTransactionalToBulk}
              onChange={(event) => setFallbackTransactionalToBulk(event.target.checked)}
            />
            <span>
              If transactional SMTP is missing or fails, send order and account
              mail through bulk SMTP.
              <span className="mt-1 block text-muted-foreground">
                Off by default. Turn on only when the transactional server is
                down or not set up yet.
              </span>
            </span>
          </label>
        </section>

        <section className="tile grid gap-3">
          <h2 className="text-lg">Notification recipients</h2>
          <label className="grid gap-1 text-sm">
            Extra admin emails
            <textarea
              className="field min-h-20"
              placeholder="Added to every Admin recipient list"
              value={extraAdminEmails}
              onChange={(event) => setExtraAdminEmails(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Warehouse 1 manager emails
            <textarea
              className="field min-h-20"
              placeholder="Used when Warehouse manager is enabled"
              value={warehouse1Emails}
              onChange={(event) => setWarehouse1Emails(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Warehouse 2 manager emails
            <textarea
              className="field min-h-20"
              placeholder="Used when Warehouse manager is enabled"
              value={warehouse2Emails}
              onChange={(event) => setWarehouse2Emails(event.target.value)}
            />
          </label>
        </section>

        <section className="tile grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Main email template</h2>
            <button
              className="ghost-btn w-fit px-3 py-1 text-xs"
              type="button"
              onClick={() => setWrapperHtml(settings.defaultWrapperHtml)}
            >
              Reset to Invictus default
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens: <code>{"{{EMAIL_BODY}}"}</code>, <code>{"{{CURRENT_YEAR}}"}</code>,{" "}
            <code>{"{{APP_NAME}}"}</code>. This wraps bulk mail, notifications, and
            test emails.
          </p>
          <textarea
            className="field min-h-56 font-mono text-xs"
            value={wrapperHtml}
            onChange={(event) => setWrapperHtml(event.target.value)}
            spellCheck={false}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
          <button className="gold-btn max-w-48" type="submit">
            Save settings
          </button>
        </section>
      </form>

      <form
        className="tile grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setTestMessage("");
          const res = await fetch("/api/admin/cms/email-test/", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ to: testTo, channel: testChannel }),
          });
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) {
            setTestMessage(payload?.error || "Test email failed.");
            return;
          }
          setTestMessage(
            testChannel === "bulk" ? "Bulk test email sent." : "Transactional test email sent.",
          );
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
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="testChannel"
              checked={testChannel === "transactional"}
              onChange={() => setTestChannel("transactional")}
            />
            Transactional SMTP
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="testChannel"
              checked={testChannel === "bulk"}
              onChange={() => setTestChannel("bulk")}
            />
            Bulk SMTP
          </label>
        </div>
        {testMessage ? <p className="text-sm text-muted-foreground">{testMessage}</p> : null}
        <button className="ghost-btn max-w-48" type="submit">
          Send test email
        </button>
      </form>
    </div>
  );
}
