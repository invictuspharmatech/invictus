"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ZohoMessage = {
  id: string;
  folderId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  replyRecipient: string;
  contentHtml: string;
  receivedAt: string | null;
};

export function ZohoMailMessageBoard({ messageId }: { messageId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId") || "";
  const mailbox = searchParams.get("mailbox") || "inbox";
  const openReply = searchParams.get("reply") === "1";

  const [msg, setMsg] = useState<ZohoMessage | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [showReply, setShowReply] = useState(openReply);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      const res = await fetch(`/api/admin/email/zoho/messages/${messageId}?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as ZohoMessage & { error?: string } | null;
      setLoading(false);
      if (!res.ok || !data || !("id" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Could not load message.");
        return;
      }
      setMsg(data);
      setReplySubject(`Re: ${data.subject}`);
    })();
  }, [folderId, messageId]);

  async function sendReply() {
    if (!msg) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/email/zoho/messages/${msg.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: replyBody,
          subject: replySubject,
          folderId: msg.folderId,
        }),
      });
      const data = (await res.json().catch(() => null)) as ZohoMessage & { error?: string } | null;
      if (!res.ok || !data || !("id" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Reply failed.");
        return;
      }
      setMsg(data);
      setReplyBody("");
      setShowReply(false);
      setSuccess(`Reply sent to ${data.replyRecipient || "recipient"}.`);
    } finally {
      setSending(false);
    }
  }

  async function resolveMessage() {
    if (!msg) return;
    if (!window.confirm("Move this message to the Resolved folder in Zoho?")) return;
    setResolving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/email/zoho/messages/${msg.id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folderId: msg.folderId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "Could not resolve message.");
        return;
      }
      router.push("/admin/email/zoho");
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading message…</p>;
  }

  if (!msg) {
    return (
      <div>
        <Link href="/admin/email/zoho" className="text-sm text-signal">
          ← Zoho Mail
        </Link>
        <p className="mt-4 text-sm text-brand-red">{error || "Message not found."}</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/email/zoho" className="text-sm text-signal">
        ← Zoho Mail
      </Link>
      <h1 className="display-font mt-4 text-3xl">{msg.subject}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        From {msg.fromName || msg.fromAddress} · To {msg.toAddress || "—"}
        {msg.receivedAt ? ` · ${new Date(msg.receivedAt).toLocaleString()}` : ""}
      </p>

      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-signal">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="gold-btn" onClick={() => setShowReply((v) => !v)}>
          {showReply ? "Hide reply" : "Reply"}
        </button>
        {mailbox === "inbox" ? (
          <button
            type="button"
            className="ghost-btn"
            disabled={resolving}
            onClick={() => void resolveMessage()}
          >
            {resolving ? "Resolving…" : "Resolve"}
          </button>
        ) : null}
      </div>

      {showReply ? (
        <section className="tile mt-4 space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            Replying to {msg.replyRecipient || msg.fromAddress}
          </p>
          <label className="grid gap-1 text-xs">
            Subject
            <input
              className="field"
              value={replySubject}
              onChange={(event) => setReplySubject(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Message
            <textarea
              className="field min-h-32"
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="gold-btn"
            disabled={sending || !replyBody.trim()}
            onClick={() => void sendReply()}
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </section>
      ) : null}

      <section className="tile mt-6 overflow-hidden p-4">
        <div
          className="prose prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: msg.contentHtml || "<p>(empty)</p>" }}
        />
      </section>
    </div>
  );
}
