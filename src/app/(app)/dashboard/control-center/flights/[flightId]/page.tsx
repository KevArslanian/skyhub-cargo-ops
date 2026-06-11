import { redirect } from "next/navigation";

type Props = { params: Promise<{ flightId: string }> };

/** Detail penerbangan dari panel jadwal */
export default async function DashboardFlightDetailPage({ params }: Props) {
  const { flightId } = await params;
  redirect(`/flight-board?id=${encodeURIComponent(flightId)}`);
}