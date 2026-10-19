"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BulkEmailRecipientStatus, BulkEmailStatus } from "@/lib/enums";
import {
  DEFAULT_BULK_BODY,
  DEFAULT_BULK_SUBJECT,
  DEFAULT_BULK_TITLE,
  bulkEmailStatusLabel,
  bulkRecipientStatusLabel,
} from "@/lib/bulk-email";
import { roleLabel } from "@/lib/roles";
import type {
  ApiAdminUser,
  ApiBulkEmailBatch,
  ApiBulkEmailDraft,
  ApiBulkEmailPreview,
  ApiBulkEmailRecipient,
} from "@/lib/api-types";

const BATCH_KEY = "invictus_bulk_email_last_batch_id";
const PAGE_SIZE = 50;

function apiError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: string }).error);
  }
  return fallback;
}

/** Local datetime-local value a few hours ahead (browser local time). */
function defaultScheduleLocal(hoursAhead = 2): string {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function BulkEmailBoard() {
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [selectAllDb, setSelectAllDb] = useState(false);
  const [manualEmails, setManualEmails] = useState("");
  const [csvText, setCsvText] = useState("");
  const [subject, setSubject] = useState(DEFAULT_BULK_SUBJECT);
  const [title, setTitle] = useState(DEFAULT_BULK_TITLE);
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BULK_BODY);
  const [chunkSize, setChunkSize] = useState(20);
  const [chunkGapMinutes, setChunkGapMinutes] = useState(5);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocal);
  const [preview, setPreview] = useState<ApiBulkEmailPreview | null>(null);
  const [tplPreview, setTplPreview] = useState<{ subject: string; html: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState("");
  const [batches, setBatches] = useState<ApiBulkEmailBatch[]>([]);
  const [batch, setBatch] = useState<ApiBulkEmailBatch | null>(null);
  const [recipientFilter, setRecipientFilter] = useState<"all" | BulkEmailRecipientStatus>("pending");
  const [recipientRows, setRecipientRows] = useState<ApiBulkEmailRecipient[]>([]);
  const [recipientCounts, setRecipientCounts] = useState({ pending: 0, sent: 0, failed: 0 });
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientLastPage, setRecipientLastPage] = useState(1);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(q) ||
        user.name.toLowerCase().includes(q) ||
        roleLabel(user.role).toLowerCase().includes(q),
    );
  }, [users, search]);
  const usersLastPage = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageUsers = filteredUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE);
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const payload = useCallback(
    (includeContent: boolean, scheduledAt?: string | null) => ({
      userIds: Object.keys(selectedIds).filter((id) => selectedIds[id]),
      selectAllUsers: selectAllDb,
      userSearch: search.trim(),
      manualEmails,
      csvText,
      ...(includeContent
        ? {
            subject,
            title,
            bodyHtml,
            chunkSize,
            chunkGapMinutes,
            ...(scheduledAt ? { scheduledAt } : {}),
          }
        : {}),
    }),
    [selectedIds, selectAllDb, search, manualEmails, csvText, subject, title, bodyHtml, chunkSize, chunkGapMinutes],
  );

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = (await res.json().catch(() => [])) as ApiAdminUser[] | { error?: string };
    if (Array.isArray(data)) setUsers(data);
  }, []);

  const loadBatches = useCallback(async () => {
    const res = await fetch("/api/admin/email/bulk/batches");
    const data = (await res.json().catch(() => [])) as ApiBulkEmailBatch[] | { error?: string };
    if (Array.isArray(data)) setBatches(data);
    return Array.isArray(data) ? data : [];
  }, []);

  const loadRecipients = useCallback(async (id: string, page: number, status: string) => {
    const res = await fetch(
      `/api/admin/email/bulk/batches/${id}/recipients?status=${encodeURIComponent(status)}&page=${page}&perPage=50`,
    );
    const data = (await res.json().catch(() => null)) as {
      counts?: { pending: number; sent: number; failed: number };
      recipients?: ApiBulkEmailRecipient[];
      pagination?: { page: number; lastPage: number };
    } | null;
    if (!data) return;
    setRecipientRows(data.recipients || []);
    setRecipientCounts(data.counts || { pending: 0, sent: 0, failed: 0 });
    setRecipientPage(data.pagination?.page || 1);
    setRecipientLastPage(data.pagination?.lastPage || 1);
  }, []);

  const openBatch = useCallback(
    async (id: string) => {
      localStorage.setItem(BATCH_KEY, id);
      const res = await fetch(`/api/admin/email/bulk/batches/${id}`);
      const data = (await res.json().catch(() => null)) as ApiBulkEmailBatch | { error?: string } | null;
      if (!res.ok || !data || !("id" in data)) return;
      setBatch(data);
      if (data.hasRecipientTracking) {
        void loadRecipients(id, 1, recipientFilter);
      }
    },
    [loadRecipients, recipientFilter],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/email/bulk/template");
      const data = (await res.json().catch(() => null)) as ApiBulkEmailDraft | null;
      if (cancelled) return;
      if (data) {
        setSubject(data.subject || DEFAULT_BULK_SUBJECT);
        setTitle(data.title || DEFAULT_BULK_TITLE);
        setBodyHtml(data.bodyHtml || DEFAULT_BULK_BODY);
        setDraftSavedAt(data.savedAt);
      }
      await loadUsers();
      const rows = await loadBatches();
      if (cancelled) return;
      const stored = localStorage.getItem(BATCH_KEY);
      const first = stored || rows[0]?.id;
      if (first) void openBatch(first);
    })();
    return () => {
      cancelled = true;
    };
    // Boot once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const sample = preview?.sample?.[0];
        const res = await fetch("/api/admin/email/bulk/render-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject,
            title,
            bodyHtml,
            previewName: sample?.name || "there",
            previewEmail: sample?.email || "preview.recipient@example.com",
          }),
        });
        const data = (await res.json().catch(() => null)) as { subject?: string; html?: string } | null;
        if (data?.html && data.subject) setTplPreview({ subject: data.subject, html: data.html });
      })();
    }, 550);
    return () => clearTimeout(timer);
  }, [subject, title, bodyHtml, preview]);

  useEffect(() => {
    if (
      !batch ||
      (batch.status !== BulkEmailStatus.RUNNING && batch.status !== BulkEmailStatus.SCHEDULED)
    ) {
      return;
    }
    const timer = setInterval(() => {
      void openBatch(batch.id);
      void loadBatches();
    }, 20000);
    return () => clearInterval(timer);
  }, [batch, loadBatches, openBatch]);

  useEffect(() => {
    if (batch?.hasRecipientTracking) {
      void loadRecipients(batch.id, recipientPage, recipientFilter);
    }
  }, [batch?.id, batch?.hasRecipientTracking, recipientFilter, recipientPage, loadRecipients]);

  async function saveDraft() {
    setPending("draft");
    setError(null);
    const res = await fetch("/api/admin/email/bulk/template", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, title, bodyHtml }),
    });
    const data = await res.json().catch(() => ({}));
    setPending("");
    if (!res.ok) {
      setError(apiError(data, "Could not save draft."));
      return;
    }
    const draft = data as ApiBulkEmailDraft;
    setDraftSavedAt(draft.savedAt);
    setMessage("Draft saved.");
  }

  async function resetDraft() {
    if (!window.confirm("Reset subject, title, and body to the factory defaults?")) return;
    setPending("draft");
    await fetch("/api/admin/email/bulk/template", { method: "DELETE" });
    setSubject(DEFAULT_BULK_SUBJECT);
    setTitle(DEFAULT_BULK_TITLE);
    setBodyHtml(DEFAULT_BULK_BODY);
    setDraftSavedAt(null);
    setPending("");
    setMessage("Template reset to defaults.");
  }

  async function runPreview() {
    setPending("preview");
    setError(null);
    const res = await fetch("/api/admin/email/bulk/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(false)),
    });
    const data = await res.json().catch(() => ({}));
    setPending("");
    if (!res.ok) {
      setPreview(null);
      setError(apiError(data, "Preview failed."));
      return;
    }
    setPreview(data as ApiBulkEmailPreview);
  }

  async function runSend(schedule: boolean) {
    if (!preview || preview.count < 1) {
      setError("Preview recipients first and ensure at least one valid address.");
      return;
    }
    let scheduledAt: string | null = null;
    if (schedule) {
      scheduledAt = localInputToIso(scheduleLocal);
      if (!scheduledAt) {
        setError("Choose a valid date and time to schedule.");
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now() + 30_000) {
        setError("Schedule time must be at least about a minute in the future.");
        return;
      }
    }
    const confirmMessage = schedule
      ? `Schedule ${preview.count} email(s) for ${new Date(scheduledAt!).toLocaleString()}? Sending will start then in bursts of ${chunkSize}, every ${chunkGapMinutes} minute(s).`
      : `Send ${preview.count} email(s) in bursts of ${chunkSize}, with a ${chunkGapMinutes} minute pause between each burst?`;
    if (!window.confirm(confirmMessage)) return;

    setPending(schedule ? "schedule" : "send");
    setError(null);
    const res = await fetch("/api/admin/email/bulk/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(true, scheduledAt)),
    });
    const data = await res.json().catch(() => ({}));
    setPending("");
    if (!res.ok) {
      setError(apiError(data, schedule ? "Could not schedule send." : "Could not start sending."));
      return;
    }
    const sent = data as { message?: string; batchId?: string; batch?: ApiBulkEmailBatch };
    setMessage(sent.message || (schedule ? "Send scheduled." : "Sending started."));
    if (sent.batch) setBatch(sent.batch);
    if (sent.batchId) {
      localStorage.setItem(BATCH_KEY, sent.batchId);
      void openBatch(sent.batchId);
    }
    void loadBatches();
  }

  async function batchAction(action: "pause" | "stop" | "resume" | "delete") {
    if (!batch) return;
    if (action === "stop") {
      const scheduled = batch.status === BulkEmailStatus.SCHEDULED;
      if (
        !window.confirm(
          scheduled
            ? "Cancel this scheduled send? No emails will go out."
            : "Stop this batch? Remaining recipients will not be sent.",
        )
      ) {
        return;
      }
    }
    if (action === "delete" && !window.confirm("Delete this batch from history?")) return;
    if (
      action === "resume" &&
      batch.status === BulkEmailStatus.SCHEDULED &&
      !window.confirm("Start this scheduled batch now instead of waiting?")
    ) {
      return;
    }
    setPending(action);
    setError(null);
    const res = await fetch(`/api/admin/email/bulk/batches/${batch.id}${action === "delete" ? "" : `/${action}`}`, {
      method: action === "delete" ? "DELETE" : "POST",
    });
    const data = await res.json().catch(() => ({}));
    setPending("");
    if (!res.ok) {
      setError(apiError(data, `Could not ${action} batch.`));
      return;
    }
    if (action === "delete") {
      localStorage.removeItem(BATCH_KEY);
      setBatch(null);
      setMessage("Batch removed from history.");
    } else {
      setBatch(data as ApiBulkEmailBatch);
      setMessage("Done.");
    }
    void loadBatches();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-font text-3xl">Bulk email</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Select customers, paste addresses, or upload a CSV. Messages send in bursts, then pause so the mailbox
          is not flooded. You can also schedule a send for later. Use <code>{"{{recipient_name}}"}</code> and{" "}
          <code>{"{{recipient_email}}"}</code> in the subject, title, or body.
        </p>
      </div>
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="tile space-y-4">
          <h2 className="text-lg">Recipients</h2>
          <input
            className="field"
            placeholder="Search users"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setUsersPage(1);
            }}
          />
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                const next = { ...selectedIds };
                for (const user of pageUsers) next[user.id] = true;
                setSelectedIds(next);
              }}
            >
              Select this page
            </button>
            <button className="ghost-btn" type="button" onClick={() => setSelectAllDb(true)}>
              Select all matching users
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                setSelectedIds({});
                setSelectAllDb(false);
              }}
            >
              Clear
            </button>
          </div>
          {selectAllDb ? (
            <p className="text-sm text-muted-foreground">
              All matching users in the database will be included ({filteredUsers.length} visible matches).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{selectedCount} selected on this list.</p>
          )}
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {pageUsers.map((user) => (
                  <tr key={user.id} className="border-t border-border/40">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={!!selectedIds[user.id]}
                        onChange={() =>
                          setSelectedIds((prev) => ({ ...prev, [user.id]: !prev[user.id] }))
                        }
                      />
                    </td>
                    <td>{user.name}</td>
                    <td className="text-muted-foreground">{user.email}</td>
                    <td className="text-muted-foreground">{roleLabel(user.role)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 text-sm">
            <button
              className="ghost-btn"
              type="button"
              disabled={usersPage <= 1}
              onClick={() => setUsersPage((page) => page - 1)}
            >
              Previous
            </button>
            <span className="self-center text-muted-foreground">
              Page {usersPage} / {usersLastPage}
            </span>
            <button
              className="ghost-btn"
              type="button"
              disabled={usersPage >= usersLastPage}
              onClick={() => setUsersPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
          <label className="grid gap-1 text-sm">
            Extra addresses
            <textarea
              className="field min-h-28"
              value={manualEmails}
              onChange={(event) => setManualEmails(event.target.value)}
              placeholder={"one@email.com\nName,another@email.com"}
            />
          </label>
          <label className="grid gap-1 text-sm">
            CSV / TXT
            <input
              className="field"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                setCsvText(file ? await file.text() : "");
              }}
            />
          </label>
          <button className="gold-btn w-fit" type="button" disabled={pending === "preview"} onClick={() => void runPreview()}>
            {pending === "preview" ? "Counting…" : "Preview recipients"}
          </button>
          {preview ? (
            <p className="text-sm">
              {preview.count} recipient(s). Sample:{" "}
              {preview.sample.map((row) => row.email).join(", ") || "—"}
            </p>
          ) : null}
        </section>

        <section className="tile space-y-4">
          <h2 className="text-lg">Message</h2>
          <label className="grid gap-1 text-sm">
            Subject
            <input className="field" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <div>
            <label className="grid gap-1 text-sm">
              Title / heading
              <input
                className="field"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Leave blank to use the subject as the email heading"
              />
            </label>
          </div>
          <div>
            <label className="grid gap-1 text-sm">
              Message
              <textarea
                className="field min-h-48"
                value={bodyHtml}
                onChange={(event) => setBodyHtml(event.target.value)}
                placeholder="Write your email message…"
              />
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Type like a normal message — press Enter for a new line. The branded
              Invictus template wraps this automatically. Placeholders such as{" "}
              <code className="rounded bg-muted px-1">{"{{recipient_name}}"}</code> work
              in the text.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              Burst size
              <input
                className="field"
                type="number"
                min={1}
                max={100}
                value={chunkSize}
                onChange={(event) => setChunkSize(Number(event.target.value) || 1)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Minutes between bursts
              <input
                className="field"
                type="number"
                min={1}
                max={1440}
                value={chunkGapMinutes}
                onChange={(event) => setChunkGapMinutes(Number(event.target.value) || 1)}
              />
            </label>
          </div>
          <div className="space-y-3 rounded border border-border/50 bg-card/40 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(event) => {
                  setScheduleEnabled(event.target.checked);
                  if (event.target.checked && !scheduleLocal) setScheduleLocal(defaultScheduleLocal());
                }}
              />
              Schedule for later
            </label>
            {scheduleEnabled ? (
              <label className="grid gap-1 text-sm">
                Start sending at
                <input
                  className="field max-w-xs"
                  type="datetime-local"
                  value={scheduleLocal}
                  min={defaultScheduleLocal(0.02)}
                  onChange={(event) => setScheduleLocal(event.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  Uses your local time. The batch is saved now and begins automatically at this time
                  (when the bulk email worker runs).
                </span>
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ghost-btn" type="button" disabled={pending === "draft"} onClick={() => void saveDraft()}>
              Save draft
            </button>
            <button className="ghost-btn" type="button" disabled={pending === "draft"} onClick={() => void resetDraft()}>
              Reset defaults
            </button>
            {scheduleEnabled ? (
              <button
                className="gold-btn"
                type="button"
                disabled={pending === "schedule" || pending === "send"}
                onClick={() => void runSend(true)}
              >
                {pending === "schedule" ? "Scheduling…" : "Schedule send"}
              </button>
            ) : (
              <button
                className="gold-btn"
                type="button"
                disabled={pending === "send" || pending === "schedule"}
                onClick={() => void runSend(false)}
              >
                {pending === "send" ? "Starting…" : "Start sending"}
              </button>
            )}
          </div>
          {draftSavedAt ? (
            <p className="text-xs text-muted-foreground">Draft saved {new Date(draftSavedAt).toLocaleString()}</p>
          ) : null}
        </section>
      </div>

      <section className="tile">
        <h2 className="text-lg">How the email will look</h2>
        {tplPreview ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted-foreground">Subject: {tplPreview.subject}</p>
            <iframe title="Email preview" className="h-[40rem] w-full rounded border border-border bg-white" srcDoc={tplPreview.html} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">The preview appears after the message loads.</p>
        )}
      </section>

      <section className="tile space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">Mail batches</h2>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              void loadBatches();
              if (batch) void openBatch(batch.id);
            }}
          >
            Refresh progress
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Subject</th>
              <th>Status</th>
              <th>Sent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td className="py-4 text-muted-foreground" colSpan={4}>
                  No batches yet.
                </td>
              </tr>
            ) : (
              batches.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="py-3">{row.subjectPreview || "—"}</td>
                  <td>
                    {bulkEmailStatusLabel(row.status)}
                    {row.status === BulkEmailStatus.SCHEDULED && (row.scheduledAt || row.nextSendAt) ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {new Date(row.scheduledAt || row.nextSendAt!).toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {row.sentCount}/{row.totalCount}
                  </td>
                  <td>
                    <button className="text-sm text-signal" type="button" onClick={() => void openBatch(row.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {batch ? (
        <section className="tile space-y-4">
          <h2 className="text-lg">{batch.subjectPreview || "Batch"}</h2>
          <p className="text-sm text-muted-foreground">
            {bulkEmailStatusLabel(batch.status)} · {batch.sentCount} sent · {batch.failedCount} failed ·{" "}
            {batch.pendingCount} pending
            {batch.status === BulkEmailStatus.SCHEDULED && (batch.scheduledAt || batch.nextSendAt)
              ? ` · starts ${new Date(batch.scheduledAt || batch.nextSendAt!).toLocaleString()}`
              : batch.nextSendAt
                ? ` · next burst ${new Date(batch.nextSendAt).toLocaleString()}`
                : ""}
          </p>
          <div className="h-2 overflow-hidden rounded bg-border">
            <div
              className="h-full bg-primary"
              style={{
                width: `${batch.totalCount ? Math.min(100, Math.round((batch.processed / batch.totalCount) * 100)) : 0}%`,
              }}
            />
          </div>
          {batch.lastError ? <p className="text-sm text-brand-red">{batch.lastError}</p> : null}
          <div className="flex flex-wrap gap-2">
            {batch.canPause ? (
              <button className="ghost-btn" type="button" disabled={!!pending} onClick={() => void batchAction("pause")}>
                Pause
              </button>
            ) : null}
            {batch.canResume ? (
              <button className="ghost-btn" type="button" disabled={!!pending} onClick={() => void batchAction("resume")}>
                {batch.status === BulkEmailStatus.SCHEDULED ? "Send now" : "Resume"}
              </button>
            ) : null}
            {batch.canStop ? (
              <button className="ghost-btn" type="button" disabled={!!pending} onClick={() => void batchAction("stop")}>
                {batch.status === BulkEmailStatus.SCHEDULED ? "Cancel schedule" : "Stop"}
              </button>
            ) : null}
            {batch.status !== BulkEmailStatus.RUNNING && batch.status !== BulkEmailStatus.SCHEDULED ? (
              <button className="ghost-btn" type="button" disabled={!!pending} onClick={() => void batchAction("delete")}>
                Delete
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", BulkEmailRecipientStatus.PENDING, BulkEmailRecipientStatus.SENT, BulkEmailRecipientStatus.FAILED] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={item === recipientFilter ? "gold-btn" : "ghost-btn"}
                  onClick={() => {
                    setRecipientFilter(item);
                    setRecipientPage(1);
                  }}
                >
                  {item === "all" ? "All" : bulkRecipientStatusLabel(item)}
                  {item !== "all" ? ` (${recipientCounts[item]})` : ""}
                </button>
              ),
            )}
          </div>
          <table className="w-full text-left text-sm">
            <tbody>
              {recipientRows.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="py-2">{row.email}</td>
                  <td>{row.name || "—"}</td>
                  <td>{bulkRecipientStatusLabel(row.status)}</td>
                  <td className="text-muted-foreground">{row.errorMessage || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 text-sm">
            <button
              className="ghost-btn"
              type="button"
              disabled={recipientPage <= 1}
              onClick={() => setRecipientPage((page) => page - 1)}
            >
              Previous
            </button>
            <span className="self-center text-muted-foreground">
              Page {recipientPage} / {recipientLastPage}
            </span>
            <button
              className="ghost-btn"
              type="button"
              disabled={recipientPage >= recipientLastPage}
              onClick={() => setRecipientPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
