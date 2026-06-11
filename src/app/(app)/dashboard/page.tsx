import { redirect } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** /dashboard → ringkasan control center */
export default function DashboardPage() {
  redirect(DASHBOARD_ROUTES.home);
}