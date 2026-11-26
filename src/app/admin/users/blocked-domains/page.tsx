"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type DomainRow = {
  id: number;
  domain: string;
  created_at: string;
};

type ResetIpBlock = {
  id: number;
  ip_address: string;
  attempted_email: string;
  blocked_at: string | null;
};

export default function BlockedDomainsPage() {
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [resetBlocks, setResetBlocks] = useState<ResetIpBlock[]>([]);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    setLoading(true);
    void Promise.all([
      fetch("/api/admin/users/blocked-domains"),
      fetch("/api/admin/users/password-reset-ip-blocks"),
    ])
      .then(async ([domainResponse, resetResponse]) => {
        const data = (await domainResponse.json()) as { data?: DomainRow[]; error?: string };
        const resetData = (await resetResponse.json()) as { data?: ResetIpBlock[]; error?: string };
        if (!domainResponse.ok) {
          setError(data.error || "Could not load domains.");
          setRows([]);
        } else {
          setRows(Array.isArray(data.data) ? data.data : []);
        }
        setResetBlocks(resetResponse.ok && Array.isArray(resetData.data) ? resetData.data : []);
      })
      .catch(() => setError("Could not load domains."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function addDomain(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users/blocked-domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not add that domain.");
        return;
      }
      setDomain("");
      setNotice("Domain added.");
      load();
    } catch {
      setError("Could not add that domain.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Blocked email domains</h1>
        </div>
        <Link href="/admin/users" className="ghost-btn">
          Back to users
        </Link>
      </div>

      <form onSubmit={addDomain} className="mt-6 flex max-w-xl flex-wrap gap-2">
        <input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="fldubai.com"
          aria-label="Domain"
          required
          className="field min-w-64 flex-1"
        />
        <button type="submit" disabled={saving} className="gold-btn">
          {saving ? "Adding…" : "Add domain"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-muted-foreground">{notice}</p> : null}

      <section className="tile mt-6">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domains yet.</p>
        ) : null}
        <ul className="divide-y divide-border/40">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{row.domain}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  if (!window.confirm(`Remove ${row.domain} from the list?`)) return;
                  setError("");
                  setNotice("");
                  void fetch(`/api/admin/users/blocked-domains/${row.id}`, { method: "DELETE" }).then(
                    async (response) => {
                      if (!response.ok) {
                        const data = (await response.json().catch(() => null)) as { error?: string } | null;
                        setError(data?.error || "Could not remove that domain.");
                        return;
                      }
                      setNotice(`${row.domain} removed.`);
                      setRows((current) => current.filter((item) => item.id !== row.id));
                    },
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="tile mt-8">
        <h2 className="text-lg">Blocked password-reset IPs</h2>
        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && resetBlocks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No password-reset IPs are blocked.</p>
        ) : null}
        <ul className="mt-2 divide-y divide-border/40">
          {resetBlocks.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{row.ip_address}</p>
                <p className="text-xs text-muted-foreground">
                  {row.attempted_email || "—"}
                  {row.blocked_at ? ` · ${new Date(row.blocked_at).toLocaleString()}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  if (!window.confirm(`Allow ${row.ip_address} to request password resets again?`)) return;
                  setError("");
                  setNotice("");
                  void fetch(`/api/admin/users/password-reset-ip-blocks/${row.id}`, { method: "DELETE" }).then(
                    async (response) => {
                      if (!response.ok) {
                        const data = (await response.json().catch(() => null)) as { error?: string } | null;
                        setError(data?.error || "Could not remove that block.");
                        return;
                      }
                      setNotice(`${row.ip_address} can request password resets again.`);
                      setResetBlocks((current) => current.filter((item) => item.id !== row.id));
                    },
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
