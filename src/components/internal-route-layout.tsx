import { requireUser } from "@/lib/auth";
import { requireInternalUser } from "@/lib/access";

export default async function InternalRouteLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  requireInternalUser(user, "/awb-tracking");

  return <>{children}</>;
}
