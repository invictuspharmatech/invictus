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
import { djangoAuthed } from "@/lib/django";

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
  }>(`/api/admin/accounting/?period=${period}&warehouse=${warehouse}`);

  return (
    <div>
      <h1 className="display-font text-3xl">Accounting</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Percentage split of proceeds received (USD, and BTC when the invoice has a crypto
        amount). Admin is always 25%. Party 1 is 60% × the W1 merchandise share of the sale.
        Party 2 is the remainder. Mixed checkouts are one sale: X comes from merchandise, then
        those percentages apply to the full proceeds. Reset a tile after you pay that party.
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
