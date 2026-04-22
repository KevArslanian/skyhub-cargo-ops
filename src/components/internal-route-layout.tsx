import { requireUser } from "@/lib/auth";
import { assertInternalApiAccess } from "@/lib/access";

export default async function InternalRouteLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  assertInternalApiAccess(user);

  return <>{children}</>;
}
