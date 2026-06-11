import { redirect } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function DashboardAlertsPage() {
  redirect(DASHBOARD_ROUTES.home);
}