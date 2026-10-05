import { requireFullAdmin } from "@/lib/auth";
import { StockAlertsBoard } from "@/components/admin/StockAlertsBoard";

export default async function AdminStockAlertsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return <StockAlertsBoard />;
}
