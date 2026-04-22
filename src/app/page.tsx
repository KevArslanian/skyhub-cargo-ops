import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? (user.role === "customer" ? "/awb-tracking" : "/dashboard") : "/about-us");
}
