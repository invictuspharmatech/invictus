"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type {
  ApiPostageAccount,
  ApiPostageCredits,
  ApiPostageSender,
  ApiPostageSettings,
} from "@/lib/api-types";
import { warehouseLabel } from "@/lib/warehouse";

const CREDIT_WAREHOUSES = ["WAREHOUSE_1", "WAREHOUSE_2"] as const;

const EMPTY_SENDER = {
  warehouse: "",
  fromName: "",
  fromStreet: "",
  fromApt: "",
  fromCity: "",
  fromState: "",
  fromZip: "",
  fromCountry: "US",
  isDefault: false,
};

async function copyText(value: string) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

type AccountDraft = {
  warehouse: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  hasSecret: boolean;
  isConfigured: boolean;
};

function draftsFromSettings(settings: ApiPostageSettings): AccountDraft[] {
  const accounts = settings.accounts?.length
    ? settings.accounts
    : ([
        {
          id: "",
          warehouse: "WAREHOUSE_1",
          warehouseLabel: "Warehouse 1",
          name: "",
          apiUrl: settings.apiUrl || "https://bitcoinpostage.info/api",
          apiKey: settings.apiKey || "",
          hasSecret: settings.hasSecret,
          isConfigured: settings.isConfigured,
        },
        {
          id: "",
          warehouse: "WAREHOUSE_2",
          warehouseLabel: "Warehouse 2",
          name: "",
          apiUrl: "https://bitcoinpostage.info/api",
          apiKey: "",
          hasSecret: false,
          isConfigured: false,
        },
      ] satisfies ApiPostageAccount[]);
  return accounts.map((row) => ({
    warehouse: row.warehouse,
    name: row.name || "",
    apiUrl: row.apiUrl || "https://bitcoinpostage.info/api",
    apiKey: row.apiKey || "",
    apiSecret: "",
    hasSecret: row.hasSecret,
    isConfigured: row.isConfigured,
  }));
}

export function BtcPostageBoard({ settings }: { settings: ApiPostageSettings }) {
  const [accounts, setAccounts] = useState<AccountDraft[]>(() => draftsFromSettings(settings));
  const [creditsByWarehouse, setCreditsByWarehouse] = useState<Record<string, string>>({});
  const [amountByWarehouse, setAmountByWarehouse] = useState<Record<string, string>>({
    WAREHOUSE_1: "",
    WAREHOUSE_2: "",
  });
  const [currencyByWarehouse, setCurrencyByWarehouse] = useState<Record<string, string>>({
    WAREHOUSE_1: "btc",
    WAREHOUSE_2: "btc",
  });
  const [chargeByWarehouse, setChargeByWarehouse] = useState<Record<string, ApiPostageCredits | null>>(
    {},
  );
  const [creditErrorByWarehouse, setCreditErrorByWarehouse] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState("");
  const [senders, setSenders] = useState<ApiPostageSender[]>([]);
  const [senderForm, setSenderForm] = useState(EMPTY_SENDER);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");

  const loadCredits = useCallback(async (warehouse: string) => {
    const response = await fetch(
      `/api/admin/btcpostage/credits?warehouse=${encodeURIComponent(warehouse)}`,
    );
    const data = (await response.json().catch(() => null)) as ApiPostageCredits | { error?: string } | null;
    if (!response.ok || !data || !("credits" in data)) {
      setCreditsByWarehouse((current) => ({ ...current, [warehouse]: "" }));
      setCreditErrorByWarehouse((current) => ({
        ...current,
        [warehouse]:
          data && "error" in data ? data.error || "Could not load credits." : "Could not load credits.",
      }));
      return;
    }
    setCreditsByWarehouse((current) => ({ ...current, [warehouse]: data.credits }));
    setCreditErrorByWarehouse((current) => ({ ...current, [warehouse]: "" }));
  }, []);

  const loadSenders = useCallback(async () => {
    const response = await fetch("/api/admin/btcpostage/senders");
    const data = (await response.json().catch(() => [])) as ApiPostageSender[];
    setSenders(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    for (const warehouse of CREDIT_WAREHOUSES) {
      void loadCredits(warehouse);
    }
    void loadSenders();
  }, [loadCredits, loadSenders]);

  async function handleCopy(key: string, value: string) {
    const ok = await copyText(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? "" : current));
    }, 1500);
  }

  function updateAccount(warehouse: string, patch: Partial<AccountDraft>) {
    setAccounts((current) =>
      current.map((row) => (row.warehouse === warehouse ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-8">
      <section className="tile space-y-4">
        <div>
          <h2 className="text-lg">API accounts by warehouse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each warehouse can use its own bitcoinpostage.info account. When you create a label,
            credentials are taken from the account linked to that order&apos;s warehouse.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.warehouse} className="grid gap-3 rounded border border-border/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{warehouseLabel(account.warehouse)}</h3>
                <span className="text-xs text-muted-foreground">
                  {account.isConfigured || account.hasSecret ? (
                    "Connected"
                  ) : (
                    <span className="text-brand-red">Not connected</span>
                  )}
                </span>
              </div>
              <label className="grid gap-1 text-sm">
                Account label
                <input
                  className="field"
                  placeholder={`e.g. ${warehouseLabel(account.warehouse)} BTC Postage`}
                  value={account.name}
                  onChange={(event) => updateAccount(account.warehouse, { name: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Linked warehouse
                <input className="field" value={warehouseLabel(account.warehouse)} disabled />
              </label>
              <label className="grid gap-1 text-sm">
                API URL
                <input
                  className="field"
                  value={account.apiUrl}
                  onChange={(event) => updateAccount(account.warehouse, { apiUrl: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                API key
                <input
                  className="field"
                  value={account.apiKey}
                  onChange={(event) => updateAccount(account.warehouse, { apiKey: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                API secret
                <input
                  className="field"
                  type="password"
                  placeholder={account.hasSecret ? "Saved — leave blank to keep" : "Secret"}
                  value={account.apiSecret}
                  onChange={(event) =>
                    updateAccount(account.warehouse, { apiSecret: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="gold-btn max-w-48"
          disabled={busy === "save"}
          onClick={async () => {
            setBusy("save");
            setError("");
            setSaved("");
            const response = await fetch("/api/admin/btcpostage", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                accounts: accounts.map((row) => ({
                  warehouse: row.warehouse,
                  name: row.name,
                  apiUrl: row.apiUrl,
                  apiKey: row.apiKey,
                  apiSecret: row.apiSecret,
                })),
              }),
            });
            const data = (await response.json().catch(() => null)) as
              | ApiPostageSettings
              | { error?: string }
              | null;
            setBusy("");
            if (!response.ok || !data || !("accounts" in data)) {
              setError(
                data && "error" in data ? data.error || "Could not save settings." : "Could not save settings.",
              );
              return;
            }
            setAccounts(draftsFromSettings(data));
            setSaved("Bitcoin Postage warehouse accounts saved.");
          }}
        >
          Save both accounts
        </button>
      </section>

      <section className="tile space-y-4">
        <div>
          <h2 className="text-lg">Label credits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance and top-up for each warehouse account, shown side by side.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {CREDIT_WAREHOUSES.map((warehouse) => {
            const credits = creditsByWarehouse[warehouse] || "";
            const amount = amountByWarehouse[warehouse] || "";
            const currency = currencyByWarehouse[warehouse] || "btc";
            const charge = chargeByWarehouse[warehouse] || null;
            const creditError = creditErrorByWarehouse[warehouse] || "";
            const chargeBusy = busy === `charge-${warehouse}`;
            const amountCopyKey = `amount-${warehouse}`;
            const addressCopyKey = `address-${warehouse}`;
            const payAmount = charge?.amount || "";
            const payCurrency = (charge?.currency || currency).toUpperCase();
            const payAddress = charge?.address || "";
            return (
              <div key={warehouse} className="grid gap-3 rounded border border-border/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{warehouseLabel(warehouse)}</h3>
                    <p className="mt-1 text-3xl">{credits ? `$${credits}` : "—"}</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy === `credits-${warehouse}`}
                    onClick={() => {
                      setBusy(`credits-${warehouse}`);
                      void loadCredits(warehouse).finally(() => setBusy(""));
                    }}
                  >
                    Refresh
                  </button>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    Amount (USD)
                    <input
                      className="field"
                      value={amount}
                      onChange={(event) =>
                        setAmountByWarehouse((current) => ({
                          ...current,
                          [warehouse]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Pay with
                    <select
                      className="field"
                      value={currency}
                      onChange={(event) =>
                        setCurrencyByWarehouse((current) => ({
                          ...current,
                          [warehouse]: event.target.value,
                        }))
                      }
                    >
                      <option value="btc">Bitcoin</option>
                      <option value="ltc">Litecoin</option>
                      <option value="xmr">Monero</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="gold-btn max-w-48"
                    disabled={chargeBusy}
                    onClick={async () => {
                      setBusy(`charge-${warehouse}`);
                      setCreditErrorByWarehouse((current) => ({ ...current, [warehouse]: "" }));
                      setChargeByWarehouse((current) => ({ ...current, [warehouse]: null }));
                      const response = await fetch("/api/admin/btcpostage/charge", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ amount, currency, warehouse }),
                      });
                      const data = (await response.json().catch(() => null)) as
                        | ApiPostageCredits
                        | { error?: string }
                        | null;
                      setBusy("");
                      if (!response.ok || !data || !("credits" in data)) {
                        setCreditErrorByWarehouse((current) => ({
                          ...current,
                          [warehouse]:
                            data && "error" in data
                              ? data.error || "Purchase failed."
                              : "Purchase failed.",
                        }));
                        return;
                      }
                      setChargeByWarehouse((current) => ({ ...current, [warehouse]: data }));
                      if (data.credits) {
                        setCreditsByWarehouse((current) => ({
                          ...current,
                          [warehouse]: data.credits,
                        }));
                      }
                    }}
                  >
                    Add funds
                  </button>
                </div>
                {payAddress ? (
                  <div className="mt-1 space-y-3 rounded border border-border/40 bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Amount ({payCurrency})
                      </p>
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs">{payAmount}</p>
                        <button
                          type="button"
                          className="ghost-btn shrink-0 !px-2 !py-1"
                          title="Copy amount"
                          onClick={() => void handleCopy(amountCopyKey, payAmount)}
                        >
                          {copiedKey === amountCopyKey ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                          <span className="sr-only">Copy amount</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Address
                      </p>
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs">{payAddress}</p>
                        <button
                          type="button"
                          className="ghost-btn shrink-0 !px-2 !py-1"
                          title="Copy address"
                          onClick={() => void handleCopy(addressCopyKey, payAddress)}
                        >
                          {copiedKey === addressCopyKey ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                          <span className="sr-only">Copy address</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {creditError ? <p className="text-sm text-brand-red">{creditError}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="tile max-w-3xl">
        <h2 className="text-lg">Sender addresses</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optionally link a sender to a warehouse so labels for that warehouse use the matching
          ship-from address.
        </p>
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
          <select
            className="field"
            value={senderForm.warehouse}
            onChange={(e) => setSenderForm({ ...senderForm, warehouse: e.target.value })}
          >
            <option value="">Any warehouse</option>
            <option value="WAREHOUSE_1">Warehouse 1</option>
            <option value="WAREHOUSE_2">Warehouse 2</option>
          </select>
          <input
            className="field"
            placeholder="Name"
            value={senderForm.fromName}
            onChange={(e) => setSenderForm({ ...senderForm, fromName: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Street"
            value={senderForm.fromStreet}
            onChange={(e) => setSenderForm({ ...senderForm, fromStreet: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Apt"
            value={senderForm.fromApt}
            onChange={(e) => setSenderForm({ ...senderForm, fromApt: e.target.value })}
          />
          <input
            className="field"
            placeholder="City"
            value={senderForm.fromCity}
            onChange={(e) => setSenderForm({ ...senderForm, fromCity: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="State"
            value={senderForm.fromState}
            onChange={(e) => setSenderForm({ ...senderForm, fromState: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="ZIP"
            value={senderForm.fromZip}
            onChange={(e) => setSenderForm({ ...senderForm, fromZip: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={senderForm.isDefault}
              onChange={(e) => setSenderForm({ ...senderForm, isDefault: e.target.checked })}
            />
            Default sender for this warehouse
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
                  {row.warehouse ? ` · ${warehouseLabel(row.warehouse)}` : " · any warehouse"}
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
