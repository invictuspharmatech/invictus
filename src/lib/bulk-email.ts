import { BulkEmailRecipientStatus, BulkEmailStatus } from "@/lib/enums";

export const DEFAULT_BULK_SUBJECT = "A message from Invictus Pharma";
export const DEFAULT_BULK_TITLE = "";
export const DEFAULT_BULK_BODY = `<p>Dear {{recipient_name}},</p>
<p>We wanted to reach out with a brief update. If you have any questions, simply reply to this email.</p>
<p>Thank you for your continued trust.</p>
<p>— Invictus Pharma</p>`;

export function asBulkEmailStatus(value: string): BulkEmailStatus {
  if (
    value === BulkEmailStatus.RUNNING ||
    value === BulkEmailStatus.PAUSED ||
    value === BulkEmailStatus.STOPPED ||
    value === BulkEmailStatus.COMPLETED ||
    value === BulkEmailStatus.INTERRUPTED
  ) {
    return value;
  }
  return BulkEmailStatus.STOPPED;
}

export function bulkEmailStatusLabel(value: string): string {
  const status = asBulkEmailStatus(value);
  switch (status) {
    case BulkEmailStatus.RUNNING:
      return "Sending";
    case BulkEmailStatus.PAUSED:
      return "Paused";
    case BulkEmailStatus.STOPPED:
      return "Stopped";
    case BulkEmailStatus.COMPLETED:
      return "Completed";
    case BulkEmailStatus.INTERRUPTED:
      return "Stopped (legacy)";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function asBulkRecipientStatus(value: string): BulkEmailRecipientStatus {
  if (
    value === BulkEmailRecipientStatus.PENDING ||
    value === BulkEmailRecipientStatus.SENT ||
    value === BulkEmailRecipientStatus.FAILED
  ) {
    return value;
  }
  return BulkEmailRecipientStatus.PENDING;
}

export function bulkRecipientStatusLabel(value: string): string {
  const status = asBulkRecipientStatus(value);
  switch (status) {
    case BulkEmailRecipientStatus.PENDING:
      return "Pending";
    case BulkEmailRecipientStatus.SENT:
      return "Sent";
    case BulkEmailRecipientStatus.FAILED:
      return "Failed";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
