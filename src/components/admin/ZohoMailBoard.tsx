"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type ZohoStatus = {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  accountsUrl: string;
  apiUrl: string;
  fromAddress: string;
  resolvedFolderId: string;
  mailboxAddress: string;
};

type ZohoRow = {
  id: string;
  folderId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  summary: string;
  isUnread: boolean;
  receivedAt: string | null;
};

type Tab = "inbox" | "outbox";

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ZohoMailBoard() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("inbox");
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [rows, setRows] = useState<ZohoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/email/zoho/status");
    const data = (await res.json().catch(() => null)) as ZohoStatus & { error?: string } | null;
    if (!res.ok || !data || !("configured" in data)) {
      setError(data && "error" in data && data.error ? data.error : "Could not load Zoho status.");
      return null;
    }
    setStatus(data);
    return data;
  }, []);

  const loadMessages = useCallback(
    async (mailbox: Tab, nextStatus?: ZohoStatus | null) => {
      const current = nextStatus ?? status;
      if (!current?.connected) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("start", "1");
      params.set("limit", "40");
      if (appliedSearch) params.set("search", appliedSearch);
      if (mailbox === "inbox" && unreadOnly) params.set("unreadOnly", "1");
      const res = await fetch(`/api/admin/email/zoho/${mailbox}?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as
        | { data?: ZohoRow[]; total?: number; error?: string }
        | null;
      setLoading(false);
      if (!res.ok || !data) {
        setError(data?.error || "Could not load messages.");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total ?? 0);
    },
    [appliedSearch, status, unreadOnly],
  );

  const oauthHandled = useRef(false);
  useEffect(() => {
    if (oauthHandled.current) return;
    const connected = searchParams.get("zoho_connected");
    const oauthError = searchParams.get("zoho_error");
    if (connected !== "1" && !oauthError) return;
    oauthHandled.current = true;
    if (connected === "1") setNotice("Zoho Mail connected.");
    else setError(`Zoho connect failed: ${oauthError}`);
    window.history.replaceState(null, "", "/admin/email/zoho");
  }, [searchParams]);

  const loadedKey = useRef("");
  useEffect(() => {
    const key = `${tab}|${appliedSearch}|${unreadOnly ? "1" : "0"}`;
    if (loadedKey.current === key) return;
    let cancelled = false;
    void (async () => {
      const next = await loadStatus();
      if (cancelled) return;
      await loadMessages(tab, next);
      if (!cancelled) loadedKey.current = key;
    })();
    return () => {
      cancelled = true;
    };
    // Fetch once per tab/search/unread change. Status updates must not retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, appliedSearch, unreadOnly]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email/zoho/connect", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { authorizationUrl?: string; error?: string }
        | null;
      if (!res.ok || !data?.authorizationUrl) {
        setError(data?.error || "Could not start Zoho connect.");
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Zoho Mail from this dashboard?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email/zoho/disconnect", { method: "POST" });
      const data = (await res.json().catch(() => null)) as ZohoStatus & { error?: string } | null;
      if (!res.ok || !data || !("configured" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Disconnect failed.");
        return;
      }
      setStatus(data);
      setRows([]);
      setTotal(0);
      setNotice("Zoho Mail disconnected.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshFolders() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/email/zoho/refresh-folders", { method: "POST" });
      const data = (await res.json().catch(() => null)) as ZohoStatus & { error?: string } | null;
      if (!res.ok || !data || !("configured" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Refresh failed.");
        return;
      }
      setStatus(data);
      setNotice("Folders refreshed.");
      await loadMessages(tab, data);
    } finally {
      setBusy(false);
    }
  }

  async function resolveRow(row: ZohoRow) {
    if (!window.confirm("Move this message to the Resolved folder in Zoho?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/email/zoho/messages/${row.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: row.folderId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "Could not resolve message.");
        return;
      }
      setNotice("Message moved to Resolved.");
      await loadMessages(tab);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-font text-3xl">Zoho Mail</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Connect the shop Zoho mailbox and manage inbox / sent mail from this dashboard.
          </p>
        </div>
        <Link href="/admin/cms/email" className="ghost-btn">
          SMTP & templates
        </Link>
      </div>

      {notice ? <p className="mt-4 text-sm text-signal">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}

      <section className="tile mt-6 space-y-3 p-4 text-sm">
        {!status ? (
          <p className="text-muted-foreground">Loading Zoho status…</p>
        ) : !status.configured ? (
          <div className="space-y-2 text-muted-foreground">
            <p className="font-medium text-foreground">Zoho API credentials are not set</p>
            <p>
              Add <code className="text-xs">ZOHO_MAIL_CLIENT_ID</code> and{" "}
              <code className="text-xs">ZOHO_MAIL_CLIENT_SECRET</code> to the server{" "}
              <code className="text-xs">.env</code>, then register this redirect URI in the Zoho API
              Console:
            </p>
            <p className="break-all font-mono text-xs text-foreground">{status.redirectUri}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {status.connected
                ? `Connected${status.mailboxAddress ? ` · ${status.mailboxAddress}` : ""}`
                : "Configured — not connected yet"}
            </span>
            {status.connected ? (
              <>
                <button type="button" className="ghost-btn" disabled={busy} onClick={() => void refreshFolders()}>
                  Refresh folders
                </button>
                <button type="button" className="ghost-btn" disabled={busy} onClick={() => void disconnect()}>
                  Disconnect
                </button>
              </>
            ) : (
              <button type="button" className="gold-btn" disabled={busy} onClick={() => void connect()}>
                Connect Zoho Mail
              </button>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-2 border-b border-border/50 pb-px">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["inbox", "Zoho Inbox"],
              ["outbox", "Zoho Outbox"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`px-3 py-2 text-[12px] uppercase tracking-[0.16em] ${
                tab === key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ghost-btn mb-1"
          disabled={loading || !status?.connected}
          onClick={() => void loadMessages(tab)}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="tile mt-4 flex flex-wrap items-center gap-2 p-3">
        <input
          className="field max-w-md"
          placeholder="Search subject, from, to…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setAppliedSearch(search.trim());
          }}
        />
        <button type="button" className="gold-btn" onClick={() => setAppliedSearch(search.trim())}>
          Search
        </button>
        {tab === "inbox" ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            Unread only
          </label>
        ) : null}
        <span className="text-xs text-muted-foreground">{total} shown</span>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading messages…</p>
      ) : !status?.connected ? (
        <p className="mt-6 text-sm text-muted-foreground">Connect Zoho Mail to load the inbox.</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No messages found.</p>
      ) : (
        <div className="tile mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2">From / To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/40 align-top">
                  <td className="px-3 py-3">
                    <p className={row.isUnread ? "font-semibold text-foreground" : ""}>
                      {tab === "inbox" ? row.fromName || row.fromAddress : row.toAddress || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tab === "inbox" ? row.fromAddress : row.fromAddress}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className={row.isUnread ? "font-semibold" : ""}>{row.subject}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.summary}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {formatWhen(row.receivedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/email/zoho/${row.id}?folderId=${encodeURIComponent(row.folderId)}&mailbox=${tab}`}
                        className="ghost-btn"
                      >
                        Open
                      </Link>
                      <Link
                        href={`/admin/email/zoho/${row.id}?folderId=${encodeURIComponent(row.folderId)}&mailbox=${tab}&reply=1`}
                        className="ghost-btn"
                      >
                        Reply
                      </Link>
                      {tab === "inbox" ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={busy}
                          onClick={() => void resolveRow(row)}
                        >
                          Resolve
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
