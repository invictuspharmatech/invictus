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
        Percentage split of proceeds received (USD, and BTC when the invoice has a crypto
        amount). Shares are configurable below; mixed checkouts are one sale: X comes from
        merchandise, then those percentages apply to the full proceeds. Reset a tile after you
        pay that party. Restoring default shares puts the original rates back.
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
      />
    </div>
  );
}
