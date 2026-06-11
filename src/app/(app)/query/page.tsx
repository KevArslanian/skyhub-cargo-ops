import { CrudPageScaffold } from "@/components/ops-ui";
import { requireRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getQueryDiagnostics } from "@/lib/query-diagnostics";
import { QueryDiagnosticsView } from "./query-diagnostics-view";

export const dynamic = "force-dynamic";

export default async function QueryPage() {
  const user = await requireUser();
  requireRole(user, ["admin"], "/dashboard");

  const diagnostics = await getQueryDiagnostics();

  return (
    <CrudPageScaffold
      className="query-viewport"
      eyebrow="Diagnostik Database"
      title="Pemeriksaan Data"
      subtitle="Ringkasan hasil kueri langsung dari basis data Neon untuk validasi tabel, relasi, dan distribusi data."
      body={<QueryDiagnosticsView diagnostics={diagnostics} />}
    />
  );
}