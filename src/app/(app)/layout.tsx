import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { OpsPanel, SkeletonBlock } from "@/components/ops-ui";
import { requireUser } from "@/lib/auth";
import { requireCustomerOrInternal } from "@/lib/access";
import { getShellData } from "@/lib/data";

export const dynamic = "force-dynamic";

function MenuLoadingFallback() {
  return (
    <div className="page-workspace">
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="h-10 w-[min(420px,100%)]" />
        <SkeletonBlock className="h-5 w-[min(640px,100%)]" />
      </div>
      <OpsPanel className="page-pane p-5">
        <SkeletonBlock className="h-8 w-48" />
        <div className="mt-5 grid gap-3">
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </OpsPanel>
    </div>
  );
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  requireCustomerOrInternal(user);
  const shellData = await getShellData(user.id);

  if (!shellData) {
    return null;
  }

  return (
    <AppShell user={shellData.user} settings={shellData.settings} notifications={shellData.notifications}>
      <Suspense fallback={<MenuLoadingFallback />}>{children}</Suspense>
    </AppShell>
  );
}
