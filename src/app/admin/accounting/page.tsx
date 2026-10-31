import { AccountingPeriod, AccountingWarehouse } from "@/lib/enums";
import { requireStaff } from "@/lib/auth";
import type {
  AccountingSaleRow,
  AccountingSummary,
  TileView,
} from "@/lib/accounting";
import { AccountingBoard } from "@/components/admin/AccountingBoard";
import { SplitForm } from "@/components/admin/SplitForm";
import { djangoAuthed } from "@/lib/django";
import type { RevenueSplit } from "@/lib/api-types";

const PERIOD = AccountingPeriod.DAY;
const WAREHOUSE = AccountingWarehouse.BOTH;

export default async function AccountingPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  const data = await djangoAuthed<{
    tiles: TileView[];
    summary: AccountingSummary;
    sales: AccountingSaleRow[];
    split?: RevenueSplit;
  }>(`/api/admin/accounting/?period=${PERIOD}&warehouse=${WAREHOUSE}`);

  const summary = data.summary ?? { proceeds: 0, w1Share: 0, allocated: 0 };
  const tiles = data.tiles ?? [];
  const countingSinceReset = Boolean(
    summary.resetAt || tiles.some((tile) => tile.resetAt),
  );

  const split = data.split ?? {
    w1Admin: 25,
    w1Party1: 60,
    w1Party2: 15,
    w2Admin: 25,
    w2Party1: 0,
    w2Party2: 75,
    defaults: {
      w1Admin: 25,
      w1Party1: 60,
      w1Party2: 15,
      w2Admin: 25,
      w2Party1: 0,
      w2Party2: 75,
    },
  };

  return (
    <div>
      <h1 className="display-font text-2xl sm:text-3xl">Accounting</h1>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
        Merchandise splits exclude shipping. Use the calculator for actual USD received; Reset
        all clears Admin, Party 1, Party 2, and Shipping for the next pay period.
      </p>
      <AccountingBoard
        tiles={tiles}
        period={PERIOD}
        warehouse={WAREHOUSE}
        summary={summary}
        sales={data.sales ?? []}
        split={split}
        countingSinceReset={countingSinceReset}
      />
      <SplitForm split={split} />
    </div>
  );
}
