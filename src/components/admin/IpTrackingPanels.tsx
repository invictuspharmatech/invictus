"use client";

import { useState } from "react";

export type LoginIpRecord = {
  ipAddress: string;
  loggedInAt: string;
};

export type LoginIpInfo = {
  loginIps?: LoginIpRecord[];
  loginIpTotal?: number;
  loginIpTrackingEnabled?: boolean;
  loginIpRecordCount?: number;
};

export type OrderWithIp = {
  customerIp?: string | null;
  ipTrackingEnabled?: boolean;
  orderIpRecordCount?: number;
};

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function LoginIpPanel({
  records,
  total,
  enabled,
  recordCount,
}: {
  records: LoginIpRecord[];
  total: number;
  enabled: boolean;
  recordCount: number;
}) {
  const [on, setOn] = useState(enabled);
  const [rows, setRows] = useState(records);
  const [shownTotal, setShownTotal] = useState(total);
  const [count, setCount] = useState(recordCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users/login-ip-tracking", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; enabled?: boolean; count?: number };
      if (!response.ok) {
        setError(data.error || "Could not save login IP tracking.");
        return;
      }
      setOn(Boolean(data.enabled));
      if (typeof data.count === "number") setCount(data.count);
    } finally {
      setBusy(false);
    }
  }

  async function wash() {
    if (!window.confirm("Wash every stored login IP? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users/login-ip-tracking", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; count?: number };
      if (!response.ok) {
        setError(data.error || "Could not wash login IP records.");
        return;
      }
      setRows([]);
      setShownTotal(0);
      setCount(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tile mt-6 max-w-3xl">
      <h2 className="text-lg">Login IP</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {on
          ? "Tracking is on. Each successful sign-in stores the public IP."
          : "Tracking is off. New sign-ins are not stored."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{count} login IP records stored.</p>
      {rows.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {rows.map((row) => (
            <li key={`${row.ipAddress}-${row.loggedInAt}`} className="flex flex-wrap justify-between gap-2">
              <span className="font-mono">{row.ipAddress}</span>
              <span className="text-muted-foreground">{formatWhen(row.loggedInAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No login IPs stored for this user.</p>
      )}
      {shownTotal > rows.length ? (
        <p className="mt-2 text-xs text-muted-foreground">Showing the latest {rows.length} of {shownTotal}.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="gold-btn" disabled={busy} onClick={() => void save(!on)}>
          {on ? "Turn tracking off" : "Turn tracking on"}
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={() => void wash()}>
          Wash all login IP records
        </button>
      </div>
    </section>
  );
}

export function OrderIpPanel({
  customerIp,
  enabled,
  recordCount,
}: {
  customerIp: string | null;
  enabled: boolean;
  recordCount: number;
}) {
  const [ip, setIp] = useState(customerIp);
  const [on, setOn] = useState(enabled);
  const [count, setCount] = useState(recordCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders/ip-tracking", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; enabled?: boolean; count?: number };
      if (!response.ok) {
        setError(data.error || "Could not save order IP tracking.");
        return;
      }
      setOn(Boolean(data.enabled));
      if (typeof data.count === "number") setCount(data.count);
    } finally {
      setBusy(false);
    }
  }

  async function wash() {
    if (!window.confirm("Wash every stored order IP? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/orders/ip-tracking", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not wash order IP records.");
        return;
      }
      setIp(null);
      setCount(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tile mt-6">
      <h2 className="text-lg">Customer IP</h2>
      <p className="mt-2 font-mono text-sm">{ip || "Not recorded"}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {on
          ? "Tracking is on. A customer checkout stores the public IP on the order number."
          : "Tracking is off. New checkouts are not stored."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{count} order IP records stored.</p>
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="gold-btn" disabled={busy} onClick={() => void save(!on)}>
          {on ? "Turn tracking off" : "Turn tracking on"}
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={() => void wash()}>
          Wash all order IP records
        </button>
      </div>
    </section>
  );
}
