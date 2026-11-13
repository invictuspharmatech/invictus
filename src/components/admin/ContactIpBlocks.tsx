"use client";

import { useEffect, useState } from "react";

type BlockRow = {
  id: number;
  ip_address: string;
  rejected_count: number;
  blocked_at: string | null;
};

export function ContactIpBlocks() {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    void fetch("/api/admin/contact/ip-blocks")
      .then(async (response) => {
        const data = (await response.json()) as { data?: BlockRow[] };
        setRows(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="tile mb-6">
      <h2 className="text-lg">Blocked contact IPs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A public IP is listed here after 2 contact messages are rejected for unsafe text. Removing a block lets that network use the contact form again.
      </p>
      {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading blocks…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No IPs are blocked from the contact form.</p>
      ) : null}
      <ul className="mt-3 divide-y divide-border/40">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">{row.ip_address}</p>
              <p className="text-xs text-muted-foreground">
                {row.rejected_count} rejected
                {row.blocked_at ? ` · blocked ${row.blocked_at}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === row.id}
              className="ghost-btn"
              onClick={() => {
                if (!window.confirm(`Remove the contact form block for ${row.ip_address}?`)) return;
                setBusyId(row.id);
                void fetch(`/api/admin/contact/ip-blocks/${row.id}`, { method: "DELETE" })
                  .then((response) => {
                    if (response.ok) setRows((current) => current.filter((item) => item.id !== row.id));
                  })
                  .finally(() => setBusyId(null));
              }}
            >
              {busyId === row.id ? "Removing…" : "Remove block"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
