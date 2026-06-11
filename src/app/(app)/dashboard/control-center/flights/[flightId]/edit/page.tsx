import { redirect } from "next/navigation";

type Props = { params: Promise<{ flightId: string }> };

/** Atur jadwal — buka Manajemen Pesawat dengan fokus edit */
export default async function DashboardFlightEditPage({ params }: Props) {
  const { flightId } = await params;
  redirect(`/flight-board?id=${encodeURIComponent(flightId)}&focus=manage`);
}