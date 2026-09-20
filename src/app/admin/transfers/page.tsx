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
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Request stock or order lines from the other warehouse. Warehouse staff only see their own
        counts. Accepting a request moves inventory and, for orders, moves analytics and shipping
        with the items.
      </p>
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
