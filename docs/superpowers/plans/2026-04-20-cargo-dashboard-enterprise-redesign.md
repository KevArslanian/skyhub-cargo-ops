# Cargo Dashboard Enterprise Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a full, uniform, desktop-first enterprise redesign for SkyHub cargo operations while preserving all existing features except application CSV export.

**Architecture:** Keep existing routes/data contracts and refactor UI in-place: shell-first, token/panel normalization, shared-component contracts, then page-by-page layout/scroll hardening. Use bounded containers and internal-scroll surfaces to enforce desktop stability. Remove CSV export only at UI/API export points and keep PDF/Print plus attachment upload behavior intact.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Prisma, next-themes, Node.js scripts for contract checks, ESLint, Next.js build.

---

## Pre-implementation prerequisites

- Work in a dedicated worktree for this execution cycle.
- Use frequent commits after each task.
- Use contract-first (failing check before implementation) for each task.

---

## File Structure and Responsibilities

### Core system files
- `src/app/globals.css`
  - Global design tokens, spacing/radius utilities, shell/frame/scroll classes, sticky table patterns.
- `src/components/app-shell.tsx`
  - Sidebar/topbar/content shell layout, desktop stability, sidebar zone separation, navigation usability.
- `src/components/ops-ui.tsx`
  - Shared UI building blocks (PageHeader, OpsPanel, SectionHeader, StatCard, FilterBar, EmptyState).
- `src/components/status-badge.tsx`
  - Semantic status rendering with non-color-only cues.

### App pages
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/shipment-ledger/page.tsx`
- `src/app/(app)/awb-tracking/page.tsx`
- `src/app/(app)/flight-board/page.tsx`
- `src/app/(app)/activity-log/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/settings/page.tsx`

### Auth/public alignment
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/about-us/page.tsx`

### CSV removal targets
- `src/app/api/exports/shipments/route.ts` (delete)
- `src/app/api/exports/activity-log/route.ts` (delete)

### Keep-intact print surfaces
- `src/app/exports/shipments/page.tsx`
- `src/app/exports/activity-log/page.tsx`

### Keep-intact attachment handling
- `src/app/api/uploads/[file]/route.ts` (no CSV attachment support removal)

### Test/verification support
- Create: `scripts/contracts/ui-contracts.mjs` (UI contract checks)
- Modify: `package.json` (add `test:contracts` script)

---

### Task 1: Shell Baseline + Contract Runner

**Files:**
- Create: `scripts/contracts/ui-contracts.mjs`
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `src/components/app-shell.tsx`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Write the failing contract check**

```js
// scripts/contracts/ui-contracts.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checks = [
  {
    file: "src/components/app-shell.tsx",
    includes: ["app-workspace", "shell-sidebar-nav-scroll", "shell-content-frame"],
  },
  {
    file: "src/app/globals.css",
    includes: [".app-workspace", ".shell-sidebar-nav-scroll", ".shell-content-frame"],
  },
];

const failures = [];
for (const check of checks) {
  const content = readFileSync(resolve(root, check.file), "utf8");
  for (const token of check.includes) {
    if (!content.includes(token)) failures.push(`${check.file} missing: ${token}`);
  }
}

if (failures.length) {
  console.error("UI contract checks failed:\n" + failures.map((x) => `- ${x}`).join("\n"));
  process.exit(1);
}

console.log("UI contract checks passed");
```

- [ ] **Step 2: Run contract check to verify it fails**

Run: `node scripts/contracts/ui-contracts.mjs`  
Expected: FAIL with missing `app-workspace` / `shell-sidebar-nav-scroll` / `shell-content-frame` tokens.

- [ ] **Step 3: Implement shell baseline + npm script**

```json
// package.json (scripts)
{
  "scripts": {
    "test:contracts": "node scripts/contracts/ui-contracts.mjs"
  }
}
```

```css
/* src/app/globals.css */
.app-workspace {
  height: 100vh;
  overflow: hidden;
}

.shell-sidebar-nav-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.shell-content-frame {
  height: calc(100vh - 132px);
  min-height: 0;
  overflow: hidden;
}
```

```tsx
// src/components/app-shell.tsx (root and key containers)
<div className={cn("app-workspace bg-[color:var(--app-bg)] text-[color:var(--app-fg)]", shellSettings.compactRows && "compact-table")}>
  ...
  <nav className={cn("shell-sidebar-nav-scroll ops-scrollbar", collapsed ? "flex flex-col items-center gap-3 px-4 py-2" : "space-y-3 px-4")}>
  ...
  <main className="shell-content-frame px-4 pb-6 lg:px-8">{children}</main>
</div>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: contracts PASS, lint PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs package.json src/app/globals.css src/components/app-shell.tsx
git commit -m "feat: establish shell scroll contracts and verification script"
```

---

### Task 2: Design Tokens + Spacing + Panel System

**Files:**
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing contract checks for token/system classes**

```js
// scripts/contracts/ui-contracts.mjs (append includes)
{
  file: "src/app/globals.css",
  includes: [
    "--panel-radius:",
    "--control-radius:",
    "--space-16:",
    ".ops-table-scroll",
    ".ops-table-sticky thead th",
    ".ops-pane-scroll",
  ],
}
```

- [ ] **Step 2: Run checks and confirm failure**

Run: `npm run test:contracts`  
Expected: FAIL with missing new token/class entries.

- [ ] **Step 3: Implement token and utility system**

```css
/* src/app/globals.css */
:root,
.light {
  --panel-radius: 28px;
  --control-radius: 18px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
}

.ops-table-scroll {
  min-height: 0;
  overflow: auto;
}

.ops-pane-scroll {
  min-height: 0;
  overflow: auto;
}

.ops-table-sticky thead th {
  position: sticky;
  top: 0;
  z-index: 2;
}
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/globals.css
git commit -m "feat: add enterprise spacing tokens and scroll utility classes"
```

---

### Task 3: Standardize Core Components (PageHeader/OpsPanel/FilterBar/StatCard/StatusBadge)

**Files:**
- Modify: `src/components/ops-ui.tsx`
- Modify: `src/components/status-badge.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing component contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/components/ops-ui.tsx",
  includes: ["ops-page-header", "ops-filter-bar", "metric-card", "ops-empty"],
},
{
  file: "src/components/status-badge.tsx",
  includes: ["aria-label", "bg-current"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL until new class contracts are applied.

- [ ] **Step 3: Implement component contract updates**

```tsx
// src/components/ops-ui.tsx (PageHeader root)
<header className={cn("ops-page-header flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between", className)}>
```

```css
/* src/app/globals.css */
.ops-page-header {
  gap: var(--space-16);
}

.metric-card {
  min-height: 154px;
  padding: var(--space-24);
}
```

```tsx
// src/components/status-badge.tsx
<span
  aria-label={label ?? value}
  className={cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em]",
    toneMap[value.toLowerCase()] || "border-[color:var(--border-strong)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)]",
    className,
  )}
>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/components/ops-ui.tsx src/components/status-badge.tsx src/app/globals.css
git commit -m "feat: standardize shared UI component contracts"
```

---

### Task 4: Dashboard Layout Hardening (Control Room)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing dashboard contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/dashboard/page.tsx",
  includes: ["dashboard-viewport", "ops-table-scroll", "ops-table-sticky", "dashboard-side-stack"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL until dashboard table wrappers/sticky class usage is updated.

- [ ] **Step 3: Implement dashboard layout/scroll updates**

```tsx
// src/app/(app)/dashboard/page.tsx
<div className="dashboard-viewport">
  ...
  <div className="ops-table-scroll ops-table-sticky table-shell">
    <table className="data-table">...</table>
  </div>
  ...
</div>
```

```css
/* src/app/globals.css */
.dashboard-viewport {
  height: calc(100vh - 158px);
  overflow: hidden;
}

.dashboard-side-stack {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
}
```

- [ ] **Step 4: Validate behavior**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

Manual check (browser): `/dashboard` at 1366x768/1440x900, verify no long body scroll and internal panel scroll only.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/dashboard/page.tsx src/app/globals.css
git commit -m "feat: enforce dashboard control-room layout and internal scroll"
```

---

### Task 5: Shipment Ledger Split-Pane + Remove CSV Button

**Files:**
- Modify: `src/app/(app)/shipment-ledger/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing ledger contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/shipment-ledger/page.tsx",
  includes: ["ledger-layout", "ops-table-scroll", "ops-table-sticky", "ops-pane-scroll", "PDF / Print"],
},
{
  file: "src/app/(app)/shipment-ledger/page.tsx",
  excludes: [">\n          CSV\n        </Link>"],
}
```

> Update runner to support `excludes` checks:

```js
if (check.excludes) {
  for (const token of check.excludes) {
    if (content.includes(token)) failures.push(`${check.file} should not include: ${token}`);
  }
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL because CSV button still exists and layout tokens missing.

- [ ] **Step 3: Implement split-pane and CSV removal**

```tsx
// src/app/(app)/shipment-ledger/page.tsx
<FilterBar className="xl:grid-cols-[1fr_180px_180px_180px_auto]">
  ...
  <Link href={`/exports/shipments?${exportParams.toString()}`} className="btn btn-secondary self-end">
    <Download size={16} />
    PDF / Print
  </Link>
</FilterBar>

<div className="ledger-layout grid gap-6 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,1fr)]">
  <OpsPanel className="p-5">
    <div className="ops-table-scroll ops-table-sticky table-shell">...</div>
  </OpsPanel>
  <OpsPanel className="ops-pane-scroll p-5">...</OpsPanel>
</div>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

Manual check (browser): `/shipment-ledger`, verify table scroll internal, drawer scroll internal, create modal scroll internal, no CSV action.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/shipment-ledger/page.tsx src/app/globals.css
git commit -m "feat: redesign shipment ledger split-pane and remove csv ui action"
```

---

### Task 6: AWB Tracking Timeline Clarity + Human-Friendly Not Found

**Files:**
- Modify: `src/app/(app)/awb-tracking/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing AWB contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/awb-tracking/page.tsx",
  includes: [
    "Received",
    "Sortation",
    "Loaded to Aircraft",
    "Departed",
    "Arrived",
    "AWB belum ditemukan",
    "Periksa kembali inputnya atau hubungi supervisor",
  ],
}
```

- [ ] **Step 2: Run checks and verify failure (if missing tokens/layout classes)**

Run: `npm run test:contracts`  
Expected: FAIL until final layout classes and copy are aligned.

- [ ] **Step 3: Implement AWB layout and timeline emphasis**

```tsx
// src/app/(app)/awb-tracking/page.tsx
<div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
  <OpsPanel className="p-5">...</OpsPanel>
  <OpsPanel className="ops-pane-scroll p-5">...</OpsPanel>
</div>

<div className="ops-pane-scroll mt-8 space-y-4">
  {shipment.trackingLogs.map((log) => (
    <div key={log.id} className="grid grid-cols-[32px_1fr] gap-4">...</div>
  ))}
</div>
```

```tsx
// human-friendly not found copy remains explicit
copy="Nomor airway bill yang Anda masukkan belum tercatat di sistem. Periksa kembali inputnya atau hubungi supervisor operasional bila barang sudah seharusnya masuk gudang udara."
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

Manual check (browser): `/awb-tracking` with valid and invalid AWB, verify timestamps visible and not-found guidance human-friendly.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/awb-tracking/page.tsx src/app/globals.css
git commit -m "feat: improve awb tracking hierarchy timeline and not-found guidance"
```

---

### Task 7: Flight Board Split + Internal Scroll Enforcement

**Files:**
- Modify: `src/app/(app)/flight-board/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing flight-board contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/flight-board/page.tsx",
  includes: ["ops-table-scroll", "ops-table-sticky", "flight-board-layout", "selectedFlight"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL until layout wrappers and classes are aligned.

- [ ] **Step 3: Implement flight-board structure updates**

```tsx
// src/app/(app)/flight-board/page.tsx
<div className="flight-board-layout grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)]">
  <OpsPanel className="p-5">
    <div className="ops-table-scroll ops-table-sticky table-shell">...</div>
  </OpsPanel>
  <OpsPanel className="ops-pane-scroll p-5">...</OpsPanel>
</div>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

Manual check (browser): `/flight-board`, verify left list primary prominence and both panes scroll internally.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/flight-board/page.tsx src/app/globals.css
git commit -m "feat: refine flight board split layout and internal scroll surfaces"
```

---

### Task 8: Activity Log Dense Formal View + Remove CSV Button

**Files:**
- Modify: `src/app/(app)/activity-log/page.tsx`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing activity-log checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/activity-log/page.tsx",
  includes: ["ops-table-scroll", "ops-table-sticky", "PDF / Print"],
  excludes: [">\n          CSV\n        </Link>"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL because CSV action still exists.

- [ ] **Step 3: Remove CSV action and enforce table wrapper classes**

```tsx
// src/app/(app)/activity-log/page.tsx
<FilterBar className="xl:grid-cols-[1fr_220px_220px_auto]">
  ...
  <Link href={`/exports/activity-log?${exportParams.toString()}`} className="btn btn-secondary self-end">
    <Filter size={16} />
    PDF / Print
  </Link>
</FilterBar>

<div className="ops-table-scroll ops-table-sticky table-shell mt-5">
  <table className="data-table">...</table>
</div>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/activity-log/page.tsx
git commit -m "feat: remove csv action from activity log and harden table layout"
```

---

### Task 9: Reports Page Conversion to Print Center (CSV-free)

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing reports contract checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/reports/page.tsx",
  includes: ["Shipment PDF / Print", "Activity PDF / Print"],
  excludes: ["Shipment Ledger CSV", "Activity Log CSV", "/api/exports/shipments", "/api/exports/activity-log"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL due current CSV cards/copy.

- [ ] **Step 3: Implement reports print-center update**

```tsx
// src/app/(app)/reports/page.tsx
<OpsPanel className="p-5">
  <SectionHeader title="Print & Report Center" subtitle="Gunakan print view untuk menyimpan PDF formal." />
  <div className="mt-5 grid gap-4 md:grid-cols-2">
    <Link href="/exports/shipments" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
      <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
      <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Shipment PDF / Print</p>
    </Link>
    <Link href="/exports/activity-log" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
      <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
      <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Activity PDF / Print</p>
    </Link>
  </div>
</OpsPanel>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/reports/page.tsx
git commit -m "feat: convert reports into pdf print center and remove csv references"
```

---

### Task 10: Settings Layout Stabilization (Rail + Internal Content Scroll)

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing settings checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/settings/page.tsx",
  includes: ["settings-layout", "settings-tab-rail", "settings-content-scroll"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL until new structural classes are applied.

- [ ] **Step 3: Implement settings structure and scroll classes**

```tsx
// src/app/(app)/settings/page.tsx
<div className="settings-layout grid gap-6 xl:grid-cols-[268px_minmax(0,1fr)]">
  <OpsPanel className="settings-tab-rail p-4">...</OpsPanel>
  <div className="settings-content-scroll space-y-6">...</div>
</div>
```

```css
/* src/app/globals.css */
.settings-tab-rail {
  position: sticky;
  top: 0;
}

.settings-content-scroll {
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(app)/settings/page.tsx src/app/globals.css
git commit -m "feat: stabilize settings rail-content layout with internal scroll"
```

---

### Task 11: Login/About Visual Alignment (Formal, Less Marketing Intensity)

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/about-us/page.tsx`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing auth/public alignment checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(auth)/login/page.tsx",
  includes: ["login-shell", "login-rail", "login-hero"],
},
{
  file: "src/app/(auth)/about-us/page.tsx",
  includes: ["about-shell", "about-frame"],
}
```

- [ ] **Step 2: Run checks and verify failure (if class structure diverges)**

Run: `npm run test:contracts`  
Expected: FAIL only if structure not aligned to contract.

- [ ] **Step 3: Implement tone-alignment adjustments**

```tsx
// login/about edits (examples)
// reduce visual dominance by lowering heavy overlay opacity and keeping formal spacing rhythm
<div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,64,175,0.76),rgba(37,99,235,0.30))]" />
```

```tsx
// preserve all existing auth/about actions and links; no feature removal
<Link href="/about-us" className="...">About Us</Link>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/(auth)/login/page.tsx src/app/(auth)/about-us/page.tsx
git commit -m "feat: align login and about visuals with enterprise ops tone"
```

---

### Task 12: Remove CSV Export APIs and Dead References

**Files:**
- Delete: `src/app/api/exports/shipments/route.ts`
- Delete: `src/app/api/exports/activity-log/route.ts`
- Modify: `scripts/contracts/ui-contracts.mjs`
- Test: `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add failing API-reference exclusion checks**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/shipment-ledger/page.tsx",
  excludes: ["/api/exports/shipments"],
},
{
  file: "src/app/(app)/activity-log/page.tsx",
  excludes: ["/api/exports/activity-log"],
},
{
  file: "src/app/(app)/reports/page.tsx",
  excludes: ["/api/exports/shipments", "/api/exports/activity-log", "CSV"],
}
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npm run test:contracts`  
Expected: FAIL until all API CSV references are removed.

- [ ] **Step 3: Remove endpoints and ensure print paths remain**

```bash
# delete only export-to-csv API route files
rm src/app/api/exports/shipments/route.ts
rm src/app/api/exports/activity-log/route.ts
```

```tsx
// keep print links intact on app pages
<Link href="/exports/shipments" ...>PDF / Print</Link>
<Link href="/exports/activity-log" ...>PDF / Print</Link>
```

- [ ] **Step 4: Run checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/api/exports/shipments/route.ts src/app/api/exports/activity-log/route.ts
git add scripts/contracts/ui-contracts.mjs src/app/(app)/shipment-ledger/page.tsx src/app/(app)/activity-log/page.tsx src/app/(app)/reports/page.tsx
git commit -m "feat: remove csv export endpoints and remaining csv references"
```

---

### Task 13: Final Consistency Pass + Build Sanity Check

**Files:**
- Modify (if needed):
  - `src/app/globals.css`
  - `src/components/app-shell.tsx`
  - `src/components/ops-ui.tsx`
  - `src/components/status-badge.tsx`
  - affected app pages from Tasks 4-11
- Test:
  - `scripts/contracts/ui-contracts.mjs`

- [ ] **Step 1: Add final contract checks for accepted constraints**

```js
// scripts/contracts/ui-contracts.mjs (append)
{
  file: "src/app/(app)/awb-tracking/page.tsx",
  includes: ["Received", "Sortation", "Loaded to Aircraft", "Departed", "Arrived"],
},
{
  file: "src/app/api/uploads/[file]/route.ts",
  includes: ["csv: \"text/csv; charset=utf-8\""],
}
```

- [ ] **Step 2: Run full contract and static checks**

Run: `npm run test:contracts && npm run lint`  
Expected: PASS.

- [ ] **Step 3: Run production build sanity check**

Run: `npm run build`  
Expected: Next.js build completes successfully.

- [ ] **Step 4: Perform manual desktop validation checklist**

Manual routes:
- `/dashboard`
- `/shipment-ledger`
- `/awb-tracking`
- `/flight-board`
- `/activity-log`
- `/reports`
- `/settings`

Manual assertions:
- desktop shell stable, no long body scroll on core operational pages
- only secondary regions scroll
- sidebar collapse/expand remains usable
- AWB timeline statuses + timestamps visible
- AWB not-found copy human-friendly
- print/PDF actions available
- CSV export actions absent
- upload/document flow unaffected

- [ ] **Step 5: Commit**

```bash
git add scripts/contracts/ui-contracts.mjs src/app/globals.css src/components/app-shell.tsx src/components/ops-ui.tsx src/components/status-badge.tsx src/app/(app)/dashboard/page.tsx src/app/(app)/shipment-ledger/page.tsx src/app/(app)/awb-tracking/page.tsx src/app/(app)/flight-board/page.tsx src/app/(app)/activity-log/page.tsx src/app/(app)/reports/page.tsx src/app/(app)/settings/page.tsx src/app/(auth)/login/page.tsx src/app/(auth)/about-us/page.tsx

git commit -m "feat: finalize enterprise cargo dashboard redesign with csv export removal"
```

---

## Spec Coverage Matrix (self-check)

- Shell + global layout rules: Tasks 1-2 ✅
- Tokens / spacing / panel system: Task 2 ✅
- Core component standardization: Task 3 ✅
- Per-page implementation:
  - dashboard: Task 4 ✅
  - shipment ledger: Task 5 ✅
  - awb tracking: Task 6 ✅
  - flight board: Task 7 ✅
  - activity log: Task 8 ✅
  - reports: Task 9 ✅
  - settings: Task 10 ✅
  - login/about alignment: Task 11 ✅
- CSV removal (UI + API): Tasks 5, 8, 9, 12 ✅
- Final consistency + build sanity: Task 13 ✅
- Keep CSV file attachment support: Task 13 check against upload route ✅

---

## Placeholder Scan (self-check)

Searched for forbidden placeholders (`TBD`, `TODO`, `implement later`, `similar to task`) in this plan: none present.

---

## Type/Signature Consistency (self-check)

- Contract runner filename/script usage is consistent across all tasks:
  - `scripts/contracts/ui-contracts.mjs`
  - `npm run test:contracts`
- Shared class contracts are reused consistently:
  - `ops-table-scroll`, `ops-table-sticky`, `ops-pane-scroll`, `shell-content-frame`

---

## Notes for implementer

- Keep edits focused on visual/layout/scroll behavior and CSV export removal.
- Do not remove non-CSV functionality.
- Do not modify Prisma schema for this feature.

---
