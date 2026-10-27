import { AccountingPeriod, AccountingWarehouse } from "@/lib/enums";
import { requireStaff } from "@/lib/auth";
import {
  asAccountingWarehouse,
  periodLabel,
  warehouseFilterLabel,
  type AccountingSaleRow,
  type AccountingSummary,
  type TileView,
} from "@/lib/accounting";
import { AccountingBoard } from "@/components/admin/AccountingBoard";
import { SplitForm } from "@/components/admin/SplitForm";
import { djangoAuthed } from "@/lib/django";
import type { RevenueSplit } from "@/lib/api-types";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; warehouse?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { period: rawPeriod, warehouse: rawWarehouse } = await searchParams;
  const period =
    rawPeriod === "WEEK"
      ? AccountingPeriod.WEEK
      : rawPeriod === "MONTH"
        ? AccountingPeriod.MONTH
        : AccountingPeriod.DAY;
  const warehouse = asAccountingWarehouse(rawWarehouse);

  const data = await djangoAuthed<{
    tiles: TileView[];
    summary: AccountingSummary;
    sales: AccountingSaleRow[];
    split?: RevenueSplit;
  }>(`/api/admin/accounting/?period=${period}&warehouse=${warehouse}`);

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
      <h1 className="display-font text-3xl">Accounting</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Party splits use merchandise only — shipping is excluded and shown on its own
        tile. Shares are configurable below. When BTC rate drift makes invoice totals
        unreliable, use the payout calculator for merchandise BTC. Reset all to 0 clears
        Admin, Party 1, Party 2, and Shipping for the next pay period.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {([AccountingPeriod.DAY, AccountingPeriod.WEEK, AccountingPeriod.MONTH] as const).map(
          (item) => (
            <a
              key={item}
              href={`/admin/accounting?period=${item}&warehouse=${warehouse}`}
              className={item === period ? "gold-btn" : "ghost-btn"}
            >
              {periodLabel(item)}
            </a>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            AccountingWarehouse.BOTH,
            AccountingWarehouse.WAREHOUSE_1,
            AccountingWarehouse.WAREHOUSE_2,
          ] as const
        ).map((item) => (
          <a
            key={item}
            href={`/admin/accounting?period=${period}&warehouse=${item}`}
            className={item === warehouse ? "gold-btn" : "ghost-btn"}
          >
            {warehouseFilterLabel(item)}
          </a>
        ))}
      </div>
      <SplitForm split={split} />
      <AccountingBoard
        tiles={data.tiles}
        period={period}
        warehouse={warehouse}
        summary={data.summary ?? { proceeds: 0, w1Share: 0, allocated: 0 }}
        sales={data.sales ?? []}
        split={split}
      />
    </div>
  );
}
