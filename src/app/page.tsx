import { redirect } from "next/navigation";
import { getCurrentUser, getDefaultRouteByRole } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDefaultRouteByRole(user.role));
  }

  redirect("/about-us");
}
