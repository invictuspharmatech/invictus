"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiOrder, ApiPostageSender } from "@/lib/api-types";

export const MAX_BTCPOSTAGE_LABEL_BATCH = 10;

const PACKAGE_PRESETS = [
  { key: "envelope", label: '10" × 14" envelope', length: "10", width: "14", height: "0.75" },
  { key: "4x6x2", label: '4" × 6" × 2"', length: "4", width: "6", height: "2" },
  { key: "9x6x2", label: '9" × 6" × 2"', length: "9", width: "6", height: "2" },
  { key: "8x6x3", label: '8" × 6" × 3"', length: "8", width: "6", height: "3" },
] as const;

const USPS_PACKAGE_TYPES = [
  {
    value: "USPScustom",
    label: "Custom Box/Package",
  },
  { value: "Parcel", label: "Parcel" },
  { value: "LargeParcel", label: "Large Parcel" },
  { value: "Flat", label: "Flat" },
  {
    value: "FlatRateEnvelope",
    label: "Flat Rate Envelope (12.5\" × 9.5\")",
  },
  {
    value: "MediumFlatRateBox",
    label: "Medium Flat Rate Box (11\" × 8.5\" × 5.5\")",
  },
] as const;

function isUspsPriorityFlatRate(packageType: string) {
  return packageType === "FlatRateEnvelope" || packageType === "MediumFlatRateBox";
}

function flatRateDimensions(packageType: string) {
  if (packageType === "MediumFlatRateBox") {
    return { length: "11", width: "8.5", height: "5.5" };
  }
  return { length: "12.5", width: "9.5", height: "0.75" };
}

type LabelForm = {
  fromName: string;
  fromStreet: string;
  fromApt: string;
  fromCity: string;
  fromState: string;
  fromZip: string;
  fromCountry: string;
  toName: string;
  toStreet: string;
  toStreet2: string;
  toCity: string;
  toState: string;
  toZip: string;
  toCountry: string;
  carrier: string;
  packageType: string;
  service: string;
  weightLbs: string;
  weightOz: string;
  length: string;
  width: string;
  height: string;
  testMode: boolean;
};

function emptyForm(order?: ApiOrder): LabelForm {
  return {
    fromName: "",
    fromStreet: "",
    fromApt: "",
    fromCity: "",
    fromState: "",
    fromZip: "",
    fromCountry: "US",
    toName: order?.customerName || "",
    toStreet: order?.shippingLine1 || "",
    toStreet2: order?.shippingLine2 || "",
    toCity: order?.shippingCity || "",
    toState: order?.shippingState || "",
    toZip: order?.shippingPostal || "",
    toCountry: order?.shippingCountry || "US",
    carrier: "usps",
    packageType: "USPScustom",
    service: "GroundAdvantage",
    weightLbs: "1",
    weightOz: "0",
    length: PACKAGE_PRESETS[0].length,
    width: PACKAGE_PRESETS[0].width,
    height: PACKAGE_PRESETS[0].height,
    testMode: false,
  };
}

function applySender(form: LabelForm, sender: ApiPostageSender): LabelForm {
  return {
    ...form,
    fromName: sender.fromName,
    fromStreet: sender.fromStreet,
    fromApt: sender.fromApt,
    fromCity: sender.fromCity,
    fromState: sender.fromState,
    fromZip: sender.fromZip,
    fromCountry: sender.fromCountry || "US",
  };
}

function recipientAddress(order: ApiOrder) {
  return {
    toName: order.customerName,
    toStreet: order.shippingLine1 || "",
    toStreet2: order.shippingLine2 || "",
    toCity: order.shippingCity || "",
    toState: order.shippingState || "",
    toZip: order.shippingPostal || "",
    toCountry: order.shippingCountry || "US",
  };
}

function createPurchaseBody(form: LabelForm, recipient: ReturnType<typeof recipientAddress>) {
  const flat = form.carrier === "usps" && isUspsPriorityFlatRate(form.packageType);
  const dims = flat
    ? flatRateDimensions(form.packageType)
    : { length: form.length, width: form.width, height: form.height };
  const service = flat ? "Priority" : form.service;
  return {
    carrier: form.carrier,
    service,
    label_format: "PDF",
    labelFormat: "PDF",
    from_name: form.fromName,
    from_street: form.fromStreet,
    from_apt: form.fromApt,
    from_city: form.fromCity,
    from_state: form.fromState,
    from_zip: form.fromZip,
    from_country: form.fromCountry || "US",
    to_name: recipient.toName,
    to_street: recipient.toStreet,
    to_street2: recipient.toStreet2,
    to_city: recipient.toCity,
    to_state: recipient.toState,
    to_zip: recipient.toZip,
    to_country: recipient.toCountry || "US",
    package_type: form.packageType,
    packagetype_usps: form.packageType,
    packageType: form.packageType,
    weight_lbs: form.weightLbs.trim() || "0",
    weight_oz: form.weightOz.trim() || "0",
    input_weight_lbs: form.weightLbs.trim() || "0",
    input_weight_oz: form.weightOz.trim() || "0",
    input_length: dims.length,
    input_width: dims.width,
    input_height: dims.height,
    length: dims.length,
    width: dims.width,
    height: dims.height,
    test_mode: form.carrier === "usps" ? form.testMode : false,
    testMode: form.carrier === "usps" ? form.testMode : false,
  };
}

export function PostageLabelModal({
  orders,
  onClose,
  onCreated,
}: {
  orders: ApiOrder[];
  onClose: () => void;
  onCreated: (updated: ApiOrder[]) => void;
}) {
  const first = orders[0];
  const bulk = orders.length > 1;
  const [form, setForm] = useState<LabelForm>(() => emptyForm(first));
  const [senders, setSenders] = useState<ApiPostageSender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/btcpostage/senders");
      const data = (await response.json().catch(() => [])) as ApiPostageSender[];
      if (cancelled || !Array.isArray(data)) return;
      setSenders(data);
      const chosen = data.find((row) => row.isDefault) || data[0];
      if (chosen) {
        setSenderId(chosen.id);
        setForm((current) => applySender(current, chosen));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requiredFrom = useMemo(
    () => ["fromName", "fromStreet", "fromCity", "fromState", "fromZip"] as const,
    [],
  );

  function setField<K extends keyof LabelForm>(key: K, value: LabelForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    for (const key of requiredFrom) {
      if (!form[key].trim()) {
        setError("Fill the sender address before creating a label.");
        return;
      }
    }
    const lbs = Number(form.weightLbs || 0);
    const oz = Number(form.weightOz || 0);
    if (lbs * 16 + oz <= 0) {
      setError("Enter a package weight.");
      return;
    }
    const targets = bulk
      ? orders
      : [
          {
            ...first,
            customerName: form.toName,
            shippingLine1: form.toStreet,
            shippingLine2: form.toStreet2,
            shippingCity: form.toCity,
            shippingState: form.toState,
            shippingPostal: form.toZip,
            shippingCountry: form.toCountry,
          },
        ];
    for (const row of targets) {
      const to = recipientAddress(row);
      if (
        !to.toName.trim() ||
        !to.toStreet.trim() ||
        !to.toCity.trim() ||
        !to.toState.trim() ||
        !to.toZip.trim()
      ) {
        setError(`Fill the recipient address for ${row.orderNumber} before creating a label.`);
        return;
      }
    }
    setBusy(true);
    const updated: ApiOrder[] = [];
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const row = targets[index];
        setProgress(`${index + 1} / ${targets.length}`);
        const response = await fetch(`/api/admin/orders/${row.id}/label`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createPurchaseBody(form, recipientAddress(row))),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; order?: ApiOrder }
          | null;
        if (!response.ok || !payload?.order) {
          const done = updated.length;
          setError(
            payload?.error ||
              `Could not create the Bitcoin Postage label for ${row.orderNumber}.` +
                (done ? ` ${done} label(s) were created before this.` : ""),
          );
          if (updated.length) onCreated(updated);
          return;
        }
        updated.push(payload.order);
      }
      onCreated(updated);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  if (!first) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="tile max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Bitcoin Postage label</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {bulk
                ? `${orders.length} order(s) · max ${MAX_BTCPOSTAGE_LABEL_BATCH} per batch · create-purchase once per order`
                : first.orderNumber}
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        {senders.length > 0 ? (
          <label className="mt-4 grid gap-1 text-sm">
            Saved sender
            <select
              className="field"
              value={senderId}
              onChange={(event) => {
                const next = senders.find((row) => row.id === event.target.value);
                setSenderId(event.target.value);
                if (next) setForm((current) => applySender(current, next));
              }}
            >
              {senders.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fromName} · {row.fromCity}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <fieldset className="grid gap-2">
            <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              From
            </legend>
            <input className="field" placeholder="Name" value={form.fromName} onChange={(e) => setField("fromName", e.target.value)} />
            <input className="field" placeholder="Street" value={form.fromStreet} onChange={(e) => setField("fromStreet", e.target.value)} />
            <input className="field" placeholder="Apt" value={form.fromApt} onChange={(e) => setField("fromApt", e.target.value)} />
            <input className="field" placeholder="City" value={form.fromCity} onChange={(e) => setField("fromCity", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="State" value={form.fromState} onChange={(e) => setField("fromState", e.target.value)} />
              <input className="field" placeholder="ZIP" value={form.fromZip} onChange={(e) => setField("fromZip", e.target.value)} />
            </div>
          </fieldset>
          {bulk ? (
            <fieldset className="grid gap-2">
              <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Recipients
              </legend>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {orders.map((row) => (
                  <li key={row.id} className="border border-border/40 p-2">
                    <p className="font-mono text-xs">{row.orderNumber}</p>
                    <p>{row.customerName}</p>
                    <p className="text-muted-foreground">
                      {row.shippingLine1}
                      {row.shippingLine2 ? `, ${row.shippingLine2}` : ""}
                      {row.shippingCity ? `, ${row.shippingCity}` : ""} {row.shippingState}{" "}
                      {row.shippingPostal}
                    </p>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                To
              </legend>
              <input className="field" placeholder="Name" value={form.toName} onChange={(e) => setField("toName", e.target.value)} />
              <input className="field" placeholder="Street" value={form.toStreet} onChange={(e) => setField("toStreet", e.target.value)} />
              <input className="field" placeholder="Street 2" value={form.toStreet2} onChange={(e) => setField("toStreet2", e.target.value)} />
              <input className="field" placeholder="City" value={form.toCity} onChange={(e) => setField("toCity", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="field" placeholder="State" value={form.toState} onChange={(e) => setField("toState", e.target.value)} />
                <input className="field" placeholder="ZIP" value={form.toZip} onChange={(e) => setField("toZip", e.target.value)} />
              </div>
            </fieldset>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Carrier
            <select className="field" value={form.carrier} onChange={(e) => setField("carrier", e.target.value)}>
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            USPS package
            <select
              className="field"
              value={form.packageType}
              onChange={(e) => {
                const packageType = e.target.value;
                const flat = isUspsPriorityFlatRate(packageType);
                const dims = flat ? flatRateDimensions(packageType) : PACKAGE_PRESETS[0];
                setForm((current) => ({
                  ...current,
                  packageType,
                  service: flat ? "Priority" : current.service || "GroundAdvantage",
                  length: dims.length,
                  width: dims.width,
                  height: dims.height,
                }));
              }}
            >
              {USPS_PACKAGE_TYPES.map((row) => (
                <option key={row.value} value={row.value}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Service
            {isUspsPriorityFlatRate(form.packageType) ? (
              <select className="field" value="Priority" disabled>
                <option value="Priority">Priority (required for flat rate)</option>
              </select>
            ) : (
              <select className="field" value={form.service} onChange={(e) => setField("service", e.target.value)}>
                <option value="GroundAdvantage">Ground Advantage</option>
                <option value="Priority">Priority</option>
              </select>
            )}
          </label>
          {form.packageType === "USPScustom" ? (
            <label className="grid gap-1 text-sm">
              Custom size
              <select
                className="field"
                value={`${form.length}|${form.width}|${form.height}`}
                onChange={(e) => {
                  const preset = PACKAGE_PRESETS.find(
                    (row) => `${row.length}|${row.width}|${row.height}` === e.target.value,
                  );
                  if (!preset) return;
                  setForm((current) => ({
                    ...current,
                    length: preset.length,
                    width: preset.width,
                    height: preset.height,
                  }));
                }}
              >
                {PACKAGE_PRESETS.map((row) => (
                  <option key={row.key} value={`${row.length}|${row.width}|${row.height}`}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">
            Weight lbs
            <input className="field" value={form.weightLbs} onChange={(e) => setField("weightLbs", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Weight oz
            <input className="field" value={form.weightOz} onChange={(e) => setField("weightOz", e.target.value)} />
          </label>
          {form.carrier === "usps" ? (
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.testMode}
                onChange={(e) => setField("testMode", e.target.checked)}
              />
              Test mode
            </label>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
        {progress ? <p className="mt-3 text-sm text-muted-foreground">Creating {progress}…</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" className="gold-btn" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creating…" : bulk ? "Create labels" : "Create label"}
          </button>
          <button type="button" className="ghost-btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
