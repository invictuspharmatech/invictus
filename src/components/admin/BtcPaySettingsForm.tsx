"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ApiBtcPaySettings } from "@/lib/api-types";

function BtcPaySettingsFormInner({ settings }: { settings: ApiBtcPaySettings }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState<
    "save" | "test" | "webhook" | "connect" | "failover-save" | "failover-test" | "failover-webhook" | "failover-connect" | ""
  >("");
  const [showAdvanced, setShowAdvanced] = useState(!settings.isConfigured);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl || "");
  const failover = settings.failover;
  const [failoverEnabled, setFailoverEnabled] = useState(Boolean(failover?.enabled));
  const [failoverServerUrl, setFailoverServerUrl] = useState(failover?.serverUrl || "");
  const [showFailoverAdvanced, setShowFailoverAdvanced] = useState(
    Boolean(failover?.isConfigured || failover?.serverUrl),
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState<{
    instructions: string[];
    apiKeyUrl: string;
    requiredPermissions?: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const btcpayError = searchParams.get("btcpay_error");
    if (connected === "1") {
      setSaved("Connected to BTCPay Server. Webhook was registered when possible.");
      router.replace("/admin/settings/btcpay");
      router.refresh();
    } else if (btcpayError) {
      setError(btcpayError);
      router.replace("/admin/settings/btcpay");
    }
  }, [searchParams, router]);

  async function readError(response: Response) {
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    return data?.error || data?.message || "Request failed.";
  }

  return (
    <div className="space-y-6">
      <div className="tile grid max-w-3xl gap-4">
        <h2 className="text-lg">BTCPay Server Payments Settings</h2>
        <p className="text-sm text-muted-foreground">
          GreatLife-style setup: enter your BTCPay URL, connect or paste API key + store ID, then
          create the webhook (or add it manually in BTCPay and paste the secret). Invoice create uses
          the same Greenfield API pattern as GreatLife.
        </p>

        <label className="grid gap-1 text-sm">
          BTCPay Server URL
          <input
            className="field"
            name="serverUrl"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://pay.example.com"
            required
          />
        </label>

        <div className="rounded border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-medium">Setup Wizard</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect opens BTCPay Authorize app with invoice + webhook permissions pre-selected. Pick
            one store and approve.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="gold-btn"
              type="button"
              disabled={busy !== ""}
              onClick={async () => {
                setError("");
                setSaved("");
                if (!serverUrl.trim()) {
                  setError("Enter BTCPay Server URL first.");
                  return;
                }
                setBusy("connect");
                const response = await fetch("/api/admin/btcpay/authorize", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ serverUrl: serverUrl.trim(), profile: "primary" }),
                });
                const data = (await response.json().catch(() => null)) as
                  | { authorizeUrl?: string; error?: string }
                  | null;
                setBusy("");
                if (!response.ok || !data?.authorizeUrl) {
                  setError(data?.error || (await readError(response)));
                  return;
                }
                window.location.href = data.authorizeUrl;
              }}
            >
              {busy === "connect" ? "Opening BTCPay…" : "Connect with BTCPay"}
            </button>
            <button
              className="ghost-btn"
              type="button"
              disabled={busy !== ""}
              onClick={async () => {
                setError("");
                if (!serverUrl.trim()) {
                  setError("Enter BTCPay Server URL first.");
                  return;
                }
                const response = await fetch("/api/admin/btcpay/instructions", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ serverUrl: serverUrl.trim() }),
                });
                const data = (await response.json().catch(() => null)) as {
                  instructions?: string[];
                  apiKeyUrl?: string;
                  requiredPermissions?: Record<string, string>;
                  error?: string;
                } | null;
                if (!response.ok || !data?.instructions || !data.apiKeyUrl) {
                  setError(data?.error || "Could not load instructions.");
                  return;
                }
                setInstructions({
                  instructions: data.instructions,
                  apiKeyUrl: data.apiKeyUrl,
                  requiredPermissions: data.requiredPermissions,
                });
                setShowInstructions(true);
              }}
            >
              Manual API key steps
            </button>
          </div>
        </div>

        <div className="rounded border border-border p-4">
          <h3 className="text-sm font-medium">Setup Status</h3>
          <p className="mt-2 text-sm">
            {settings.isConfigured ? (
              <span>Connected{settings.storeId ? ` · store ${settings.storeId}` : ""}</span>
            ) : (
              <span className="text-brand-red">Not connected</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Webhook URL BTCPay should call: {settings.webhookUrl}
          </p>
          <p className="mt-2 text-sm">
            Webhook:{" "}
            {settings.webhookStatus?.configured ? (
              <span>configured</span>
            ) : (
              <span className="text-brand-red">not set up yet</span>
            )}
            {settings.webhookStatus?.message ? ` — ${settings.webhookStatus.message}` : ""}
          </p>
        </div>

        <div className="rounded border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Advanced / manual setup</h3>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide" : "Show"} connection settings
            </button>
          </div>

          {showAdvanced ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSaved("");
                setBusy("save");
                const form = new FormData(event.currentTarget);
                const payload = {
                  serverUrl: String(form.get("serverUrl") || serverUrl || ""),
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
              <input type="hidden" name="serverUrl" value={serverUrl} />
              <label className="grid gap-1 text-sm">
                Store ID
                <input
                  className="field"
                  name="storeId"
                  placeholder="BTCPay store ID"
                  defaultValue={settings.storeId}
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
              <button className="gold-btn max-w-48" type="submit" disabled={busy !== ""}>
                {busy === "save" ? "Saving…" : "Save connection"}
              </button>
            </form>
          ) : null}
        </div>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {saved ? <p className="text-sm">{saved}</p> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="gold-btn"
          type="button"
          disabled={busy !== "" || !settings.isConfigured}
          onClick={async () => {
            setError("");
            setSaved("");
            setBusy("test");
            const response = await fetch("/api/admin/btcpay/test", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ profile: "primary" }),
            });
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
            const response = await fetch("/api/admin/btcpay/webhook", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ profile: "primary" }),
            });
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

      <div className="tile grid max-w-3xl gap-4">
        <h2 className="text-lg">Failover BTCPay (optional)</h2>
        <p className="text-sm text-muted-foreground">
          Connect a second BTCPay Server without changing the primary connection. Checkout tries
          primary first; if invoice create fails for any reason (timeout, 5xx, Cloudflare 403/1010,
          permission-looking blocks, etc.), it retries on this failover. If both fail, shoppers see
          the same error as today.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={failoverEnabled}
            onChange={(event) => setFailoverEnabled(event.target.checked)}
          />
          <span>
            <strong>Enable failover</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              Leave off until the second server URL, store ID, and API key are saved.
            </span>
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          Failover BTCPay Server URL
          <input
            className="field"
            value={failoverServerUrl}
            onChange={(event) => setFailoverServerUrl(event.target.value)}
            placeholder="https://backup-pay.example.com"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="gold-btn"
            type="button"
            disabled={busy !== ""}
            onClick={async () => {
              setError("");
              setSaved("");
              if (!failoverServerUrl.trim()) {
                setError("Enter failover BTCPay Server URL first.");
                return;
              }
              setBusy("failover-connect");
              const response = await fetch("/api/admin/btcpay/authorize", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  serverUrl: failoverServerUrl.trim(),
                  profile: "secondary",
                }),
              });
              const data = (await response.json().catch(() => null)) as
                | { authorizeUrl?: string; error?: string }
                | null;
              setBusy("");
              if (!response.ok || !data?.authorizeUrl) {
                setError(data?.error || (await readError(response)));
                return;
              }
              window.location.href = data.authorizeUrl;
            }}
          >
            {busy === "failover-connect" ? "Opening…" : "Connect failover BTCPay"}
          </button>
          <button
            type="button"
            className="text-sm underline underline-offset-4"
            onClick={() => setShowFailoverAdvanced((value) => !value)}
          >
            {showFailoverAdvanced ? "Hide" : "Show"} failover manual settings
          </button>
        </div>
        <p className="text-sm">
          Failover status:{" "}
          {failover?.isConfigured ? (
            <span>connected{failover.storeId ? ` · store ${failover.storeId}` : ""}</span>
          ) : (
            <span className="text-brand-red">not connected</span>
          )}
          {" · "}
          webhook:{" "}
          {failover?.webhookStatus?.configured ? (
            <span>configured</span>
          ) : (
            <span className="text-brand-red">not set up yet</span>
          )}
        </p>
        {showFailoverAdvanced ? (
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setSaved("");
              setBusy("failover-save");
              const form = new FormData(event.currentTarget);
              const response = await fetch("/api/admin/btcpay", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  profile: "secondary",
                  enabled: failoverEnabled,
                  serverUrl: String(form.get("failoverServerUrl") || failoverServerUrl || ""),
                  apiKey: String(form.get("failoverApiKey") || ""),
                  storeId: String(form.get("failoverStoreId") || ""),
                  webhookSecret: String(form.get("failoverWebhookSecret") || ""),
                }),
              });
              setBusy("");
              if (!response.ok) {
                setError(await readError(response));
                return;
              }
              setSaved("Failover BTCPay settings saved. Primary connection was not changed.");
              router.refresh();
            }}
          >
            <input type="hidden" name="failoverServerUrl" value={failoverServerUrl} />
            <label className="grid gap-1 text-sm">
              Failover store ID
              <input
                className="field"
                name="failoverStoreId"
                defaultValue={failover?.storeId || ""}
                placeholder="Failover BTCPay store ID"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Failover API key
              <input
                className="field"
                name="failoverApiKey"
                type="password"
                autoComplete="off"
                placeholder={
                  failover?.isConfigured
                    ? "Leave blank to keep the current failover key"
                    : "Paste the full failover BTCPay API key"
                }
              />
              {failover?.apiKey ? (
                <span className="text-xs text-muted-foreground">Current key: {failover.apiKey}</span>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              Failover webhook secret (optional)
              <input
                className="field"
                name="failoverWebhookSecret"
                type="password"
                autoComplete="off"
                placeholder={
                  failover?.webhookSecret
                    ? "Leave blank to keep the current failover secret"
                    : "Created automatically when possible"
                }
              />
            </label>
            <button className="gold-btn max-w-56" type="submit" disabled={busy !== ""}>
              {busy === "failover-save" ? "Saving…" : "Save failover only"}
            </button>
          </form>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            className="ghost-btn"
            type="button"
            disabled={busy !== "" || !failover?.isConfigured}
            onClick={async () => {
              setError("");
              setSaved("");
              setBusy("failover-test");
              const response = await fetch("/api/admin/btcpay/test", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ profile: "secondary" }),
              });
              const data = (await response.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null;
              setBusy("");
              if (!response.ok) {
                setError(data?.error || data?.message || "Failover connection test failed.");
                return;
              }
              setSaved(data?.message || "Failover connection succeeded.");
              router.refresh();
            }}
          >
            {busy === "failover-test" ? "Testing…" : "Test failover"}
          </button>
          <button
            className="ghost-btn"
            type="button"
            disabled={busy !== "" || !failover?.isConfigured}
            onClick={async () => {
              setError("");
              setSaved("");
              setBusy("failover-webhook");
              const response = await fetch("/api/admin/btcpay/webhook", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ profile: "secondary" }),
              });
              const data = (await response.json().catch(() => null)) as
                | { message?: string; error?: string }
                | null;
              setBusy("");
              if (!response.ok) {
                setError(data?.error || data?.message || "Failover webhook setup failed.");
                return;
              }
              setSaved(data?.message || "Failover webhook created.");
              router.refresh();
            }}
          >
            {busy === "failover-webhook" ? "Creating…" : "Create failover webhook"}
          </button>
        </div>
      </div>

      {showInstructions && instructions ? (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <div className="w-full max-w-xl border border-border bg-background p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-medium">BTCPay API key instructions</h3>
                <button type="button" className="ghost-btn px-3 py-1 text-xs" onClick={() => setShowInstructions(false)}>
                  Close
                </button>
              </div>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {instructions.instructions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              {instructions.requiredPermissions ? (
                <ul className="mt-4 space-y-1 text-sm">
                  {Object.values(instructions.requiredPermissions).map((label) => (
                    <li key={label}>✓ {label}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-2">
                <a className="gold-btn inline-flex" href={instructions.apiKeyUrl} target="_blank" rel="noreferrer">
                  Open BTCPay API Keys
                </a>
                <button type="button" className="ghost-btn" onClick={() => setShowInstructions(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BtcPaySettingsForm({ settings }: { settings: ApiBtcPaySettings }) {
  return (
    <Suspense fallback={<div className="tile max-w-3xl p-6 text-sm text-muted-foreground">Loading…</div>}>
      <BtcPaySettingsFormInner settings={settings} />
    </Suspense>
  );
}
