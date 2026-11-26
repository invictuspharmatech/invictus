import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { TransferBoard } from "@/components/admin/TransferBoard";
import type {
  ApiFulfillmentRequest,
  ApiProduct,
  ApiStockTransfer,
  ApiWarehouseSettings,
} from "@/lib/api-types";

export default async function TransfersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const [stockTransfers, fulfillmentRequests, products, policy] = await Promise.all([
    djangoAuthed<ApiStockTransfer[]>("/api/admin/stock-transfers/"),
    djangoAuthed<ApiFulfillmentRequest[]>("/api/admin/fulfillment-requests/"),
    djangoAuthed<ApiProduct[]>("/api/admin/products/"),
    djangoAuthed<ApiWarehouseSettings>("/api/cms/warehouse-policy/"),
  ]);

  return (
    <div>
      <h1 className="display-font text-3xl">Transfers</h1>
      <TransferBoard
        stockTransfers={stockTransfers}
        fulfillmentRequests={fulfillmentRequests}
        products={products}
        role={staff.role}
        requestEnabled={policy.splitEnabled && policy.warehouseRequestEnabled}
      />
    </div>
  );
}
