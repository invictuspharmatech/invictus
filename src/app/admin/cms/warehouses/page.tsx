import { redirect } from "next/navigation";

export default function WarehouseSettingsRedirect() {
  redirect("/admin/warehouses");
}
