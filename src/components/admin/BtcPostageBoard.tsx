"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiPostageCredits, ApiPostageSender, ApiPostageSettings } from "@/lib/api-types";

const EMPTY_SENDER = {
  fromName: "",
  fromStreet: "",
  fromApt: "",
  fromCity: "",
  fromState: "",
  fromZip: "",
  fromCountry: "US",
  isDefault: false,
};

export function BtcPostageBoard({ settings }: { settings: ApiPostageSettings }) {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiSecret, setApiSecret] = useState("");
  const [credits, setCredits] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("btc");
  const [charge, setCharge] = useState<ApiPostageCredits | null>(null);
  const [senders, setSenders] = useState<ApiPostageSender[]>([]);
  const [senderForm, setSenderForm] = useState(EMPTY_SENDER);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");

  const loadCredits = useCallback(async () => {
    const response = await fetch("/api/admin/btcpostage/credits");
    const data = (await response.json().catch(() => null)) as ApiPostageCredits | { error?: string } | null;
    if (!response.ok || !data || !("credits" in data)) {
      setCredits("");
      setError(
        data && "error" in data ? data.error || "Could not load credits." : "Could not load credits.",
      );
      return;
    }
    setCredits(data.credits);
  }, []);

  const loadSenders = useCallback(async () => {
    const response = await fetch("/api/admin/btcpostage/senders");
    const data = (await response.json().catch(() => [])) as ApiPostageSender[];
    setSenders(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadCredits();
    void loadSenders();
  }, [loadCredits, loadSenders]);

  return (
    <div className="space-y-8">
      <section className="tile grid max-w-3xl gap-3">
        <h2 className="text-lg">API credentials</h2>
        <p className="text-sm text-muted-foreground">
          Key and secret from bitcoinpostage.info. Use the API base URL only
          (https://bitcoinpostage.info/api), not the create-purchase path. Labels are purchased
          from the orders list.
        </p>
        <p className="text-sm">
          Status: {settings.isConfigured ? "Connected" : <span className="text-brand-red">Not connected</span>}
        </p>
        <label className="grid gap-1 text-sm">
          API URL
          <input className="field" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          API key
          <input className="field" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          API secret
          <input
            className="field"
            type="password"
            placeholder={settings.hasSecret ? "Saved — leave blank to keep" : "Secret"}
            value={apiSecret}
            onChange={(event) => setApiSecret(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="gold-btn max-w-40"
          disabled={busy === "save"}
          onClick={async () => {
            setBusy("save");
            setError("");
            setSaved("");
            const response = await fetch("/api/admin/btcpostage", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ apiUrl, apiKey, apiSecret }),
            });
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            setBusy("");
            if (!response.ok) {
              setError(data?.error || "Could not save settings.");
              return;
            }
            setSaved("Bitcoin Postage settings saved.");
          }}
        >
          Save
        </button>
      </section>

      <section className="tile max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Label credits</h2>
            <p className="mt-1 text-3xl">{credits ? `$${credits}` : "—"}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={() => void loadCredits()}>
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            Amount (USD)
            <input className="field" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Pay with
            <select className="field" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="btc">Bitcoin</option>
              <option value="ltc">Litecoin</option>
              <option value="xmr">Monero</option>
            </select>
          </label>
          <button
            type="button"
            className="gold-btn max-w-48"
            disabled={busy === "charge"}
            onClick={async () => {
              setBusy("charge");
              setError("");
              setCharge(null);
              const response = await fetch("/api/admin/btcpostage/charge", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ amount, currency }),
              });
              const data = (await response.json().catch(() => null)) as
                | ApiPostageCredits
                | { error?: string }
                | null;
              setBusy("");
              if (!response.ok || !data || !("credits" in data)) {
                setError(
                  data && "error" in data ? data.error || "Purchase failed." : "Purchase failed.",
                );
                return;
              }
              setCharge(data);
              if (data.credits) setCredits(data.credits);
            }}
          >
            Add funds
          </button>
        </div>
        {charge?.address ? (
          <div className="mt-4 text-sm">
            <p>Send {charge.amount} {(charge.currency || currency).toUpperCase()} to:</p>
            <p className="mt-2 break-all font-mono text-xs">{charge.address}</p>
          </div>
        ) : null}
      </section>

      <section className="tile max-w-3xl">
        <h2 className="text-lg">Sender addresses</h2>
        <form
          className="mt-4 grid gap-2 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy("sender");
            setError("");
            const response = await fetch("/api/admin/btcpostage/senders", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(senderForm),
            });
            setBusy("");
            if (!response.ok) {
              const data = (await response.json().catch(() => null)) as { error?: string } | null;
              setError(data?.error || "Could not save sender.");
              return;
            }
            setSenderForm(EMPTY_SENDER);
            await loadSenders();
          }}
        >
          <input className="field" placeholder="Name" value={senderForm.fromName} onChange={(e) => setSenderForm({ ...senderForm, fromName: e.target.value })} required />
          <input className="field" placeholder="Street" value={senderForm.fromStreet} onChange={(e) => setSenderForm({ ...senderForm, fromStreet: e.target.value })} required />
          <input className="field" placeholder="Apt" value={senderForm.fromApt} onChange={(e) => setSenderForm({ ...senderForm, fromApt: e.target.value })} />
          <input className="field" placeholder="City" value={senderForm.fromCity} onChange={(e) => setSenderForm({ ...senderForm, fromCity: e.target.value })} required />
          <input className="field" placeholder="State" value={senderForm.fromState} onChange={(e) => setSenderForm({ ...senderForm, fromState: e.target.value })} required />
          <input className="field" placeholder="ZIP" value={senderForm.fromZip} onChange={(e) => setSenderForm({ ...senderForm, fromZip: e.target.value })} required />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={senderForm.isDefault}
              onChange={(e) => setSenderForm({ ...senderForm, isDefault: e.target.checked })}
            />
            Default sender
          </label>
          <button className="gold-btn max-w-40" type="submit" disabled={busy === "sender"}>
            Add sender
          </button>
        </form>
        <ul className="mt-6 divide-y divide-border/40 text-sm">
          {senders.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p>
                  {row.fromName}
                  {row.isDefault ? " · default" : ""}
                </p>
                <p className="text-muted-foreground">
                  {row.fromStreet}, {row.fromCity} {row.fromState} {row.fromZip}
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={async () => {
                  await fetch(`/api/admin/btcpostage/senders/${row.id}`, { method: "DELETE" });
                  await loadSenders();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
    </div>
  );
}
