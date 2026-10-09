import { redirect } from "next/navigation";

export default function LegacyBtcPayPage() {
  redirect("/admin/settings/btcpay");
}
