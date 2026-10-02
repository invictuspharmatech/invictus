import { requireStaff } from "@/lib/auth";
import { djangoAuthed } from "@/lib/django";
import { BtcPostageBoard } from "@/components/admin/BtcPostageBoard";
import type { ApiPostageSettings } from "@/lib/api-types";

export default async function BtcPostagePage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const settings = await djangoAuthed<ApiPostageSettings>("/api/admin/btcpostage/");
  return (
    <div>
      <h1 className="display-font text-3xl">Bitcoin Postage</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Credits and labels from bitcoinpostage.info. Create labels from an order, and keep sender
        addresses here for reuse.
      </p>
      <div className="mt-8">
        <BtcPostageBoard settings={settings} />
      </div>
    </div>
  );
}
