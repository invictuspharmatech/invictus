"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiOrder, ApiPostageSender } from "@/lib/api-types";
import { warehouseShort } from "@/lib/warehouse";

export const MAX_BTCPOSTAGE_LABEL_BATCH = 10;

const PACKAGE_PRESETS = [
  { key: "envelope", label: '10" × 14" envelope', length: "10", width: "14", height: "0.75" },
  { key: "4x6x2", label: '4" × 6" × 2"', length: "4", width: "6", height: "2" },
  { key: "9x6x2", label: '9" × 6" × 2"', length: "9", width: "6", height: "2" },
  { key: "8x6x3", label: '8" × 6" × 3"', length: "8", width: "6", height: "3" },
] as const;

const USPS_PACKAGE_TYPES = [
  { value: "USPScustom", label: "Custom Box/Package" },
  { value: "Parcel", label: "Parcel" },
  { value: "LargeParcel", label: "Large Parcel" },
  { value: "Flat", label: "Flat" },
  {
    value: "FlatRateEnvelope",
    label: 'Flat Rate Envelope (12.5" × 9.5")',
  },
  {
    value: "MediumFlatRateBox",
    label: 'Medium Flat Rate Box (11" × 8.5" × 5.5")',
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

type SenderForm = {
  fromName: string;
  fromStreet: string;
  fromApt: string;
  fromCity: string;
  fromState: string;
  fromZip: string;
  fromCountry: string;
};

type RecipientForm = {
  toName: string;
  toStreet: string;
  toStreet2: string;
  toCity: string;
  toState: string;
  toZip: string;
  toCountry: string;
};

type PackageForm = {
  carrier: string;
  packageType: string;
  service: string;
  weightLbs: string;
  weightOz: string;
  length: string;
  width: string;
  height: string;
};

function emptySender(): SenderForm {
  return {
    fromName: "",
    fromStreet: "",
    fromApt: "",
    fromCity: "",
    fromState: "",
    fromZip: "",
    fromCountry: "US",
  };
}

function emptyRecipient(order?: ApiOrder): RecipientForm {
  return {
    toName: order?.customerName || "",
    toStreet: order?.shippingLine1 || "",
    toStreet2: order?.shippingLine2 || "",
    toCity: order?.shippingCity || "",
    toState: order?.shippingState || "",
    toZip: order?.shippingPostal || "",
    toCountry: order?.shippingCountry || "US",
  };
}

function emptyPackage(): PackageForm {
  return {
    carrier: "usps",
    packageType: "USPScustom",
    service: "GroundAdvantage",
    weightLbs: "1",
    weightOz: "0",
    length: PACKAGE_PRESETS[0].length,
    width: PACKAGE_PRESETS[0].width,
    height: PACKAGE_PRESETS[0].height,
  };
}

function applySender(form: SenderForm, sender: ApiPostageSender): SenderForm {
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

/** Prefer the default (or any) sender for the order's warehouse; fall back globally. */
function pickDefaultSender(
  senders: ApiPostageSender[],
  warehouse: string | null | undefined,
): ApiPostageSender | undefined {
  if (!senders.length) return undefined;
  const code = (warehouse || "").trim().toUpperCase();
  if (code) {
    const forWh = senders.filter((row) => (row.warehouse || "").trim().toUpperCase() === code);
    const preferred = forWh.find((row) => row.isDefault) || forWh[0];
    if (preferred) return preferred;
  }
  return senders.find((row) => row.isDefault) || senders[0];
}

function senderOptionLabel(row: ApiPostageSender) {
  const wh =
    row.warehouse === "WAREHOUSE_1"
      ? " · WH1"
      : row.warehouse === "WAREHOUSE_2"
        ? " · WH2"
        : row.warehouse
          ? ` · ${row.warehouse}`
          : "";
  return `${row.fromName} · ${row.fromCity}${wh}${row.isDefault ? " (default)" : ""}`;
}

function hasMixedWarehouses(orders: ApiOrder[]) {
  const codes = new Set(
    orders.map((row) => (row.warehouse || "").trim().toUpperCase()).filter(Boolean),
  );
  return codes.size > 1;
}

function seedPerOrderSenders(orders: ApiOrder[], senders: ApiPostageSender[]) {
  const forms: Record<string, SenderForm> = {};
  const ids: Record<string, string> = {};
  for (const order of orders) {
    const chosen = pickDefaultSender(senders, order.warehouse);
    forms[order.id] = chosen ? applySender(emptySender(), chosen) : emptySender();
    ids[order.id] = chosen?.id || "";
  }
  return { forms, ids };
}

function validateSender(from: SenderForm, label = "sender"): string | null {
  if (
    !from.fromName.trim() ||
    !from.fromStreet.trim() ||
    !from.fromCity.trim() ||
    !from.fromState.trim() ||
    !from.fromZip.trim()
  ) {
    return `Fill the ${label} address before creating a label.`;
  }
  return null;
}

function SenderSelect({
  senders,
  value,
  onChange,
  compact = false,
}: {
  senders: ApiPostageSender[];
  value: string;
  onChange: (senderId: string, sender: ApiPostageSender | undefined) => void;
  compact?: boolean;
}) {
  if (!senders.length) return null;
  return (
    <label className={compact ? "grid gap-0.5 text-xs text-muted-foreground" : "grid gap-1 text-sm"}>
      Saved sender
      <select
        className={compact ? "field !py-1.5 text-sm" : "field"}
        value={value}
        onChange={(event) => {
          const next = senders.find((row) => row.id === event.target.value);
          onChange(event.target.value, next);
        }}
      >
        {senders.map((row) => (
          <option key={row.id} value={row.id}>
            {senderOptionLabel(row)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SenderFields({
  sender,
  onChange,
  compact = false,
}: {
  sender: SenderForm;
  onChange: (patch: Partial<SenderForm>) => void;
  compact?: boolean;
}) {
  const fieldClass = compact ? "field !py-1.5 text-sm" : "field";
  return (
    <div className="grid gap-2">
      <input
        className={fieldClass}
        placeholder="Name"
        value={sender.fromName}
        onChange={(e) => onChange({ fromName: e.target.value })}
      />
      <input
        className={fieldClass}
        placeholder="Street"
        value={sender.fromStreet}
        onChange={(e) => onChange({ fromStreet: e.target.value })}
      />
      <input
        className={fieldClass}
        placeholder="Apt"
        value={sender.fromApt}
        onChange={(e) => onChange({ fromApt: e.target.value })}
      />
      <input
        className={fieldClass}
        placeholder="City"
        value={sender.fromCity}
        onChange={(e) => onChange({ fromCity: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={fieldClass}
          placeholder="State"
          value={sender.fromState}
          onChange={(e) => onChange({ fromState: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="ZIP"
          value={sender.fromZip}
          onChange={(e) => onChange({ fromZip: e.target.value })}
        />
      </div>
    </div>
  );
}

function createPurchaseBody(
  sender: SenderForm,
  recipient: RecipientForm,
  pkg: PackageForm,
  testMode: boolean,
) {
  const flat = pkg.carrier === "usps" && isUspsPriorityFlatRate(pkg.packageType);
  const dims = flat
    ? flatRateDimensions(pkg.packageType)
    : { length: pkg.length, width: pkg.width, height: pkg.height };
  const service = flat ? "Priority" : pkg.service;
  return {
    carrier: pkg.carrier,
    service,
    label_format: "PDF",
    labelFormat: "PDF",
    from_name: sender.fromName,
    from_street: sender.fromStreet,
    from_apt: sender.fromApt,
    from_city: sender.fromCity,
    from_state: sender.fromState,
    from_zip: sender.fromZip,
    from_country: sender.fromCountry || "US",
    to_name: recipient.toName,
    to_street: recipient.toStreet,
    to_street2: recipient.toStreet2,
    to_city: recipient.toCity,
    to_state: recipient.toState,
    to_zip: recipient.toZip,
    to_country: recipient.toCountry || "US",
    package_type: pkg.packageType,
    packagetype_usps: pkg.packageType,
    packageType: pkg.packageType,
    weight_lbs: pkg.weightLbs.trim() || "0",
    weight_oz: pkg.weightOz.trim() || "0",
    input_weight_lbs: pkg.weightLbs.trim() || "0",
    input_weight_oz: pkg.weightOz.trim() || "0",
    input_length: dims.length,
    input_width: dims.width,
    input_height: dims.height,
    length: dims.length,
    width: dims.width,
    height: dims.height,
    test_mode: pkg.carrier === "usps" ? testMode : false,
    testMode: pkg.carrier === "usps" ? testMode : false,
  };
}

function PackageFields({
  pkg,
  onChange,
  compact = false,
}: {
  pkg: PackageForm;
  onChange: (patch: Partial<PackageForm>) => void;
  compact?: boolean;
}) {
  const flat = isUspsPriorityFlatRate(pkg.packageType);
  const fieldClass = compact ? "field !py-1.5 text-sm" : "field";
  const labelClass = compact
    ? "grid gap-0.5 text-xs text-muted-foreground"
    : "grid gap-1 text-sm";

  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 md:grid-cols-3"}`}>
      <label className={labelClass}>
        Carrier
        <select
          className={fieldClass}
          value={pkg.carrier}
          onChange={(e) => onChange({ carrier: e.target.value })}
        >
          <option value="usps">USPS</option>
          <option value="ups">UPS</option>
          <option value="fedex">FedEx</option>
        </select>
      </label>
      <label className={labelClass}>
        USPS package
        <select
          className={fieldClass}
          value={pkg.packageType}
          onChange={(e) => {
            const packageType = e.target.value;
            const nextFlat = isUspsPriorityFlatRate(packageType);
            const dims = nextFlat ? flatRateDimensions(packageType) : PACKAGE_PRESETS[0];
            onChange({
              packageType,
              service: nextFlat ? "Priority" : pkg.service || "GroundAdvantage",
              length: dims.length,
              width: dims.width,
              height: dims.height,
            });
          }}
        >
          {USPS_PACKAGE_TYPES.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Service
        {flat ? (
          <select className={fieldClass} value="Priority" disabled>
            <option value="Priority">Priority (required for flat rate)</option>
          </select>
        ) : (
          <select
            className={fieldClass}
            value={pkg.service}
            onChange={(e) => onChange({ service: e.target.value })}
          >
            <option value="GroundAdvantage">Ground Advantage</option>
            <option value="Priority">Priority</option>
          </select>
        )}
      </label>
      {pkg.packageType === "USPScustom" ? (
        <label className={labelClass}>
          Custom size
          <select
            className={fieldClass}
            value={`${pkg.length}|${pkg.width}|${pkg.height}`}
            onChange={(e) => {
              const preset = PACKAGE_PRESETS.find(
                (row) => `${row.length}|${row.width}|${row.height}` === e.target.value,
              );
              if (!preset) return;
              onChange({
                length: preset.length,
                width: preset.width,
                height: preset.height,
              });
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
      <label className={labelClass}>
        Weight lbs
        <input
          className={fieldClass}
          value={pkg.weightLbs}
          onChange={(e) => onChange({ weightLbs: e.target.value })}
        />
      </label>
      <label className={labelClass}>
        Weight oz
        <input
          className={fieldClass}
          value={pkg.weightOz}
          onChange={(e) => onChange({ weightOz: e.target.value })}
        />
      </label>
      {!flat ? (
        <>
          <label className={labelClass}>
            Length
            <input
              className={fieldClass}
              value={pkg.length}
              onChange={(e) => onChange({ length: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Width
            <input
              className={fieldClass}
              value={pkg.width}
              onChange={(e) => onChange({ width: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Height
            <input
              className={fieldClass}
              value={pkg.height}
              onChange={(e) => onChange({ height: e.target.value })}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

function RecipientFields({
  recipient,
  onChange,
  compact = false,
}: {
  recipient: RecipientForm;
  onChange: (patch: Partial<RecipientForm>) => void;
  compact?: boolean;
}) {
  const fieldClass = compact ? "field !py-1.5 text-sm" : "field";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input
        className={`${fieldClass} sm:col-span-2`}
        placeholder="Name"
        value={recipient.toName}
        onChange={(e) => onChange({ toName: e.target.value })}
      />
      <input
        className={`${fieldClass} sm:col-span-2`}
        placeholder="Street"
        value={recipient.toStreet}
        onChange={(e) => onChange({ toStreet: e.target.value })}
      />
      <input
        className={`${fieldClass} sm:col-span-2`}
        placeholder="Apt / Street 2"
        value={recipient.toStreet2}
        onChange={(e) => onChange({ toStreet2: e.target.value })}
      />
      <input
        className={fieldClass}
        placeholder="City"
        value={recipient.toCity}
        onChange={(e) => onChange({ toCity: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={fieldClass}
          placeholder="State"
          value={recipient.toState}
          onChange={(e) => onChange({ toState: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="ZIP"
          value={recipient.toZip}
          onChange={(e) => onChange({ toZip: e.target.value })}
        />
      </div>
    </div>
  );
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
  const mixedWarehouses = useMemo(() => hasMixedWarehouses(orders), [orders]);
  const [sharedFrom, setSharedFrom] = useState(() => !hasMixedWarehouses(orders));
  const [sender, setSender] = useState<SenderForm>(() => emptySender());
  const [recipient, setRecipient] = useState<RecipientForm>(() => emptyRecipient(first));
  const [pkg, setPkg] = useState<PackageForm>(() => emptyPackage());
  const [recipientsById, setRecipientsById] = useState<Record<string, RecipientForm>>(() =>
    Object.fromEntries(orders.map((row) => [row.id, emptyRecipient(row)])),
  );
  const [packagesById, setPackagesById] = useState<Record<string, PackageForm>>(() =>
    Object.fromEntries(orders.map((row) => [row.id, emptyPackage()])),
  );
  const [sendersById, setSendersById] = useState<Record<string, SenderForm>>(() =>
    Object.fromEntries(orders.map((row) => [row.id, emptySender()])),
  );
  const [senderIdsById, setSenderIdsById] = useState<Record<string, string>>(() =>
    Object.fromEntries(orders.map((row) => [row.id, ""])),
  );
  const [senders, setSenders] = useState<ApiPostageSender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const orderIdsKey = orders.map((row) => row.id).join(",");
  useEffect(() => {
    setSharedFrom(!hasMixedWarehouses(orders));
    setRecipient(emptyRecipient(first));
    setRecipientsById(Object.fromEntries(orders.map((row) => [row.id, emptyRecipient(row)])));
    setPackagesById(Object.fromEntries(orders.map((row) => [row.id, emptyPackage()])));
    if (senders.length) {
      const seeded = seedPerOrderSenders(orders, senders);
      setSendersById(seeded.forms);
      setSenderIdsById(seeded.ids);
      const chosen = pickDefaultSender(senders, first?.warehouse);
      if (chosen) {
        setSenderId(chosen.id);
        setSender(applySender(emptySender(), chosen));
      }
    } else {
      setSendersById(Object.fromEntries(orders.map((row) => [row.id, emptySender()])));
      setSenderIdsById(Object.fromEntries(orders.map((row) => [row.id, ""])));
    }
    // Re-seed only when the selected order set changes, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderIdsKey is the intentional dependency
  }, [orderIdsKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/btcpostage/senders");
      const data = (await response.json().catch(() => [])) as ApiPostageSender[];
      if (cancelled || !Array.isArray(data)) return;
      setSenders(data);
      const chosen = pickDefaultSender(data, first?.warehouse);
      if (chosen) {
        setSenderId(chosen.id);
        setSender(applySender(emptySender(), chosen));
      }
      const seeded = seedPerOrderSenders(orders, data);
      setSendersById(seeded.forms);
      setSenderIdsById(seeded.ids);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed against current selection when senders load
  }, [first?.warehouse, orderIdsKey]);

  function updateBulkRecipient(orderId: string, patch: Partial<RecipientForm>) {
    setRecipientsById((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] || emptyRecipient()), ...patch },
    }));
  }

  function updateBulkPackage(orderId: string, patch: Partial<PackageForm>) {
    setPackagesById((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] || emptyPackage()), ...patch },
    }));
  }

  function updateBulkSender(orderId: string, patch: Partial<SenderForm>) {
    setSendersById((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] || emptySender()), ...patch },
    }));
  }

  function validateRecipient(to: RecipientForm, orderNumber: string): string | null {
    if (
      !to.toName.trim() ||
      !to.toStreet.trim() ||
      !to.toCity.trim() ||
      !to.toState.trim() ||
      !to.toZip.trim()
    ) {
      return `Fill the recipient address for ${orderNumber} before creating a label.`;
    }
    return null;
  }

  function validatePackage(rowPkg: PackageForm, orderNumber: string): string | null {
    const lbs = Number(rowPkg.weightLbs || 0);
    const oz = Number(rowPkg.weightOz || 0);
    if (lbs * 16 + oz <= 0) {
      return `Enter a package weight for ${orderNumber}.`;
    }
    return null;
  }

  async function submit() {
    setError("");

    const useSharedFrom = !bulk || sharedFrom;
    if (useSharedFrom) {
      const fromError = validateSender(sender);
      if (fromError) {
        setError(fromError);
        return;
      }
    }

    const targets = orders.map((row) => {
      const to = bulk ? recipientsById[row.id] || emptyRecipient(row) : recipient;
      const rowPkg = bulk ? packagesById[row.id] || emptyPackage() : pkg;
      const from = useSharedFrom
        ? sender
        : sendersById[row.id] || emptySender();
      return { order: row, to, pkg: rowPkg, from };
    });

    for (const target of targets) {
      if (!useSharedFrom) {
        const fromError = validateSender(
          target.from,
          `FROM address for ${target.order.orderNumber}`,
        );
        if (fromError) {
          setError(fromError);
          return;
        }
      }
      const recipientError = validateRecipient(target.to, target.order.orderNumber);
      if (recipientError) {
        setError(recipientError);
        return;
      }
      const packageError = validatePackage(target.pkg, target.order.orderNumber);
      if (packageError) {
        setError(packageError);
        return;
      }
    }

    setBusy(true);
    const updated: ApiOrder[] = [];
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        setProgress(`${index + 1} / ${targets.length}`);
        const response = await fetch(`/api/admin/orders/${target.order.id}/label`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            createPurchaseBody(target.from, target.to, target.pkg, testMode),
          ),
        });
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; order?: ApiOrder }
          | null;
        if (!response.ok || !payload?.order) {
          const done = updated.length;
          setError(
            payload?.error ||
              `Could not create the Bitcoin Postage label for ${target.order.orderNumber}.` +
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/80 p-0 sm:items-center sm:p-4">
      <div
        className={`tile flex h-[100dvh] w-full flex-col !p-0 sm:h-auto sm:max-h-[min(92vh,92dvh)] ${
          bulk ? "max-w-5xl" : "max-w-3xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="postage-label-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-3 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="postage-label-title" className="text-base sm:text-lg">
              {bulk ? "Bitcoin Postage — Bulk labels" : "Bitcoin Postage label"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {bulk
                ? `${orders.length} order(s) · max ${MAX_BTCPOSTAGE_LABEL_BATCH} per batch · ${
                    sharedFrom ? "shared FROM" : "per-order FROM (warehouse default)"
                  } · per-order TO & package`
                : first.orderNumber}
              {" · "}
              Uses the BTC Postage account linked to each order&apos;s warehouse
              {!bulk && first.warehouse
                ? ` (${first.warehouse.replace("_", " ").toLowerCase()})`
                : ""}
              .
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn shrink-0 !px-3 !py-2"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
          {bulk ? (
            <div className="space-y-3">
              <label className="flex items-start gap-2 rounded border border-border/50 bg-muted/20 p-3 text-sm">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  checked={sharedFrom}
                  onChange={(e) => setSharedFrom(e.target.checked)}
                />
                <span>
                  <strong>Use one common FROM address</strong> for every order in this batch.
                  {mixedWarehouses ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Selection includes both warehouses — leave unchecked to use each order&apos;s
                      own warehouse default sender (recommended).
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Uncheck to set FROM separately on each order row (same as single-label
                      creation).
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 rounded border border-border/50 bg-muted/20 p-3 text-sm">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                />
                <span>
                  <strong>Test mode (USPS)</strong> — applies to every USPS label in this batch.
                  Unchecked = live labels (credits used).
                </span>
              </label>
            </div>
          ) : null}

          {!bulk || sharedFrom ? (
            <div className={`mt-4 grid gap-4 ${bulk ? "" : "md:grid-cols-2"}`}>
              <fieldset className="grid gap-2">
                <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {bulk ? "From (shared)" : "From"}
                </legend>
                <SenderSelect
                  senders={senders}
                  value={senderId}
                  onChange={(id, next) => {
                    setSenderId(id);
                    if (next) setSender(applySender(emptySender(), next));
                  }}
                />
                <SenderFields
                  sender={sender}
                  onChange={(patch) => setSender((current) => ({ ...current, ...patch }))}
                />
                {!bulk ? (
                  <label className="mt-1 flex items-start gap-2 rounded border border-border/50 bg-muted/20 p-3 text-sm">
                    <input
                      className="mt-0.5"
                      type="checkbox"
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                    />
                    <span>
                      <strong>Test mode (USPS)</strong>. Unchecked = live labels (credits used).
                    </span>
                  </label>
                ) : null}
              </fieldset>

              {!bulk ? (
                <fieldset className="grid gap-2">
                  <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    To
                  </legend>
                  <RecipientFields
                    recipient={recipient}
                    onChange={(patch) => setRecipient((current) => ({ ...current, ...patch }))}
                  />
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {!bulk ? (
            <div className="mt-4">
              <PackageFields
                pkg={pkg}
                onChange={(patch) => setPkg((current) => ({ ...current, ...patch }))}
              />
            </div>
          ) : (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">
                Each order
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {sharedFrom
                  ? "Edit recipient and parcel options per order. Shared FROM + USPS test mode apply to all."
                  : "Each order has its own FROM (warehouse default + dropdown), recipient, and parcel options. USPS test mode still applies to all."}
              </p>
              <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                {orders.map((row) => {
                  const to = recipientsById[row.id] || emptyRecipient(row);
                  const rowPkg = packagesById[row.id] || emptyPackage();
                  const rowFrom = sendersById[row.id] || emptySender();
                  return (
                    <div
                      key={row.id}
                      className="space-y-3 rounded border border-border/50 bg-muted/10 p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-mono text-sm font-semibold">{row.orderNumber}</p>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {warehouseShort(row.warehouse)} · {row.customerName}
                        </span>
                      </div>
                      {!sharedFrom ? (
                        <div className="space-y-2 rounded border border-border/40 bg-background/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">
                            From ({warehouseShort(row.warehouse)} default)
                          </p>
                          <SenderSelect
                            compact
                            senders={senders}
                            value={senderIdsById[row.id] || ""}
                            onChange={(id, next) => {
                              setSenderIdsById((current) => ({ ...current, [row.id]: id }));
                              if (next) {
                                setSendersById((current) => ({
                                  ...current,
                                  [row.id]: applySender(emptySender(), next),
                                }));
                              }
                            }}
                          />
                          <SenderFields
                            compact
                            sender={rowFrom}
                            onChange={(patch) => updateBulkSender(row.id, patch)}
                          />
                        </div>
                      ) : null}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          To
                        </p>
                        <RecipientFields
                          compact
                          recipient={to}
                          onChange={(patch) => updateBulkRecipient(row.id, patch)}
                        />
                      </div>
                      <div className="border-t border-border/40 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-signal">
                          Parcel &amp; service (this order)
                        </p>
                        <PackageFields
                          compact
                          pkg={rowPkg}
                          onChange={(patch) => updateBulkPackage(row.id, patch)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
          {progress ? (
            <p className="mt-3 text-sm text-muted-foreground">Creating {progress}…</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
          <button
            type="button"
            className="gold-btn"
            disabled={busy}
            onClick={() => void submit()}
          >
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
