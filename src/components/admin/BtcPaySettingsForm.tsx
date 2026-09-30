"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiBtcPaySettings } from "@/lib/api-types";

export function BtcPaySettingsForm({ settings }: { settings: ApiBtcPaySettings }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "webhook" | "">("");

  async function readError(response: Response) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return data?.error || "Request failed.";
  }

  return (
    <div className="space-y-6">
      <form
        className="tile grid max-w-3xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSaved("");
          setBusy("save");
          const form = new FormData(event.currentTarget);
          const payload = {
            serverUrl: String(form.get("serverUrl") || ""),
            apiKey: String(form.get("apiKey") || ""),
            storeId: String(form.get("storeId") || ""),
            webhookSecret: String(form.get("webhookSecret") || ""),
            invoiceExpirationMinutes: Number(form.get("invoiceExpirationMinutes") || 480),
            defaultCustomerMessage: String(form.get("defaultCustomerMessage") || ""),
          };
          const response = await fetch("/api/admin/btcpay", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          setBusy("");
          if (!response.ok) {
            setError(await readError(response));
            return;
          }
          setSaved("BTCPay settings saved.");
          router.refresh();
        }}
      >
        <h2 className="text-lg">Connect BTCPay Server</h2>
        <p className="text-sm text-muted-foreground">
          Create an API key on your BTCPay Server with invoice and webhook permissions, then paste
          the server URL, key, and store ID here. Saving a new API key also tries to register the
          payment webhook automatically.
        </p>
        <p className="text-sm">
          Status:{" "}
          {settings.isConfigured ? (
            <span className="text-foreground">Connected</span>
          ) : (
            <span className="text-brand-red">Not connected</span>
          )}
        </p>
        <label className="grid gap-1 text-sm">
          Server URL
          <input
            className="field"
            name="serverUrl"
            placeholder="https://pay.example.com"
            defaultValue={settings.serverUrl}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Store ID
          <input
            className="field"
            name="storeId"
            placeholder="BTCPay store ID"
            defaultValue={settings.storeId}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          API key
          <input
            className="field"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={
              settings.isConfigured
                ? "Leave blank to keep the current key"
                : "Paste the full BTCPay API key"
            }
          />
          {settings.apiKey ? (
            <span className="text-xs text-muted-foreground">Current key: {settings.apiKey}</span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          Webhook secret (optional)
          <input
            className="field"
            name="webhookSecret"
            type="password"
            autoComplete="off"
            placeholder={
              settings.webhookSecret
                ? "Leave blank to keep the current secret"
                : "Usually created automatically"
            }
          />
          {settings.webhookSecret ? (
            <span className="text-xs text-muted-foreground">
              Current secret: {settings.webhookSecret}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          Invoice expiration (minutes)
          <input
            className="field max-w-40"
            name="invoiceExpirationMinutes"
            type="number"
            min={5}
            max={10080}
            defaultValue={settings.invoiceExpirationMinutes}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Customer message
          <input
            className="field"
            name="defaultCustomerMessage"
            defaultValue={settings.defaultCustomerMessage}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Webhook URL BTCPay should call: {settings.webhookUrl}
        </p>
        <p className="text-sm">
          Webhook: {settings.webhookStatus?.configured ? "configured" : "not set up yet"}
          {settings.webhookStatus?.message ? ` — ${settings.webhookStatus.message}` : ""}
        </p>
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {saved ? <p className="text-sm">{saved}</p> : null}
        <button className="gold-btn max-w-48" type="submit" disabled={busy !== ""}>
          {busy === "save" ? "Saving…" : "Save connection"}
        </button>
      </form>
      <div className="flex flex-wrap gap-3">
        <button
          className="gold-btn"
          type="button"
          disabled={busy !== "" || !settings.isConfigured}
          onClick={async () => {
            setError("");
            setSaved("");
            setBusy("test");
            const response = await fetch("/api/admin/btcpay/test", { method: "POST" });
            const data = (await response.json().catch(() => null)) as
              | { message?: string; error?: string }
              | null;
            setBusy("");
            if (!response.ok) {
              setError(data?.error || data?.message || "Connection test failed.");
              return;
            }
            setSaved(data?.message || "Connection succeeded.");
            router.refresh();
          }}
        >
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button
          className="gold-btn"
          type="button"
          disabled={busy !== "" || !settings.isConfigured}
          onClick={async () => {
            setError("");
            setSaved("");
            setBusy("webhook");
            const response = await fetch("/api/admin/btcpay/webhook", { method: "POST" });
            const data = (await response.json().catch(() => null)) as
              | { message?: string; error?: string }
              | null;
            setBusy("");
            if (!response.ok) {
              setError(data?.error || data?.message || "Webhook setup failed.");
              return;
            }
            setSaved(data?.message || "Webhook created.");
            router.refresh();
          }}
        >
          {busy === "webhook" ? "Creating…" : "Create webhook"}
        </button>
      </div>
    </div>
  );
}
