import { requireUser } from "@/lib/auth";
import { assertRoles } from "@/lib/access";

export default async function SettingsRouteLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  assertRoles(user, ["admin", "supervisor"], "Akses settings dibatasi untuk supervisor atau admin.", "SETTINGS_ONLY");

  return <>{children}</>;
}
