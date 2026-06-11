import { redirect } from "next/navigation";

/** Semua jadwal — delegasi ke Manajemen Pesawat */
export default function DashboardFlightsListPage() {
  redirect("/flight-board");
}