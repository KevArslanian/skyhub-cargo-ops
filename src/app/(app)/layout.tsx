import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getShellData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const shellData = await getShellData(user.id);

  if (!shellData) {
    return null;
  }

  return (
    <AppShell user={shellData.user} settings={shellData.settings} notifications={shellData.notifications}>
      {children}
    </AppShell>
  );
}
