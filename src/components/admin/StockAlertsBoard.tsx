"use client";

import { useCallback, useEffect, useState } from "react";

type Batch = {
  id: string;
  productName: string;
  status: string;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  lastError: string;
  createdAt: string | null;
};

type Sub = {
  id: string;
  email: string;
  name: string;
  status: string;
  productName: string;
  createdAt: string | null;
};

export function StockAlertsBoard() {
  const [tab, setTab] = useState<"batches" | "subscriptions">("batches");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [batchRes, subRes] = await Promise.all([
      fetch("/api/admin/stock-notifications/batches"),
      fetch("/api/admin/stock-notifications/subscriptions"),
    ]);
    const batchPayload = (await batchRes.json().catch(() => null)) as Batch[] | { error?: string };
    const subPayload = (await subRes.json().catch(() => null)) as Sub[] | { error?: string };
    if (!batchRes.ok || !Array.isArray(batchPayload)) {
      setError((batchPayload && "error" in batchPayload && batchPayload.error) || "Could not load alerts.");
      return;
    }
    setBatches(batchPayload);
    setSubs(Array.isArray(subPayload) ? subPayload : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string) {
    await fetch(`/api/admin/stock-notifications/batches/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="display-font text-3xl">Stock alerts</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Customers can subscribe on out-of-stock products. When stock returns, a batch emails them.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" className={tab === "batches" ? "gold-btn" : "ghost-btn"} onClick={() => setTab("batches")}>
          Batches
        </button>
        <button
          type="button"
          className={tab === "subscriptions" ? "gold-btn" : "ghost-btn"}
          onClick={() => setTab("subscriptions")}
        >
          Subscriptions
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}
      {tab === "batches" ? (
        <div className="tile mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Product</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Pending</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-t border-border/40">
                  <td className="py-3">{batch.productName}</td>
                  <td>{batch.status}</td>
                  <td>{batch.sentCount}</td>
                  <td>{batch.failedCount}</td>
                  <td>{batch.pendingCount}</td>
                  <td className="space-x-2">
                    <button type="button" className="text-sm" onClick={() => void act(batch.id, "pause")}>
                      Pause
                    </button>
                    <button type="button" className="text-sm" onClick={() => void act(batch.id, "resume")}>
                      Resume
                    </button>
                    <button type="button" className="text-sm" onClick={() => void act(batch.id, "stop")}>
                      Stop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tile mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Email</th>
                <th>Product</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="py-3">{row.email}</td>
                  <td>{row.productName}</td>
                  <td>{row.status}</td>
                  <td>{row.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
