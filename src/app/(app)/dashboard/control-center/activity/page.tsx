import { redirect } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

export default function DashboardActivityPage() {
  redirect(DASHBOARD_ROUTES.home);
}