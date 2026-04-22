# SkyHub Cargo Dashboard Enterprise Redesign (Approach A)

Date: 2026-04-20
Status: Revised after stakeholder feedback (9.2/10)

---

## 1) Scope and Final Constraints

Implement a one-pass enterprise redesign for the existing SkyHub cargo operations app, focused on desktop-first operator workflow quality, without removing existing capabilities except CSV export.

### Non-negotiable constraints
- Preserve all existing routes and legacy features.
- Remove only **application CSV export** feature surface.
- Keep **Print/PDF** export flows fully functional.
- Keep UTS cargo requirements fully satisfied.
- Keep AWB timeline with required statuses and timestamp visibility.
- Keep AWB not-found state human-friendly.
- Keep sidebar permanent/collapsible usability.
- Keep desktop shell stable (no long main-shell/body scroll for major work pages).
- Keep upload handling safe, including `.csv` as shipment attachment files.
- Avoid major functional regression.

### Out of scope
- No database schema redesign.
- No backend contract changes beyond CSV export endpoint removal.
- No removal of non-CSV features.

---

## 2) Existing-State Audit Summary

### Core layout and shared UI
- `src/components/app-shell.tsx`
- `src/components/ops-ui.tsx`
- `src/app/globals.css`

### Core operational pages
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/shipment-ledger/page.tsx`
- `src/app/(app)/awb-tracking/page.tsx`
- `src/app/(app)/flight-board/page.tsx`
- `src/app/(app)/activity-log/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/settings/page.tsx`

### Auth/public pages (visual alignment only)
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/about-us/page.tsx`

### CSV export touchpoints to remove
- UI:
  - `src/app/(app)/shipment-ledger/page.tsx`
  - `src/app/(app)/activity-log/page.tsx`
  - `src/app/(app)/reports/page.tsx`
- API:
  - `src/app/api/exports/shipments/route.ts`
  - `src/app/api/exports/activity-log/route.ts`

### Keep-safe attachment capability
- `src/app/api/uploads/[file]/route.ts` keeps CSV MIME acceptance for shipment documents.

---

## 3) Visual System Baseline

### Palette
- Primary blue: `#003D9B`
- Hover/active blue: `#0052CC`
- Blue soft: `rgba(0, 61, 155, 0.08)`
- App bg light: `#EFF4FA`
- Panel bg: `#FFFFFF`
- Panel muted: `#F4F7FB`
- Text primary: `#12233D`
- Text secondary: `#61748D`
- Border soft: `#D7E2EF`
- Border strong: `#C4D2E4`
- Success: `#1F9D55`
- Warning: `#C97A00`
- Danger: `#C62828`

### Typography
- Clean sans-serif stack (existing).
- Strong, formal headers; readable dense body text.
- KPI values prominent but restrained.

### Shape/depth/spacing
- Main panel radius: 24–28px.
- Input/button radius: 16–18px.
- Border-led depth, soft shadow only.
- Spacing system:
  - 8 micro
  - 12 label-control
  - 16 common gap
  - 20 small-group gap
  - 24 panel padding
  - 32 major section gap

### Density rules (hard)
- KPI card min height: 154px desktop, 144px tablet.
- Filter bar min height: 88px desktop.
- Standard control height: 48px.
- Primary button min height: 46px.
- Table header target height: 48px.
- Table body row target:
  - default: 56px (min 52px)
  - compact: 48px (min 44px)
- Secondary/meta text clamp:
  - table meta max 2 lines
  - card body max 3 lines

---

## 4) Shell + Global Layout Rules (Desktop-first)

### Target desktop frames
- 1366×768
- 1440×900
- 1536×864

### App shell structure
- Fixed sidebar (left), sticky topbar, bounded content frame.
- Content padding:
  - desktop: 24px
  - tablet: 20px
  - mobile: 16px

### Sidebar
- Expanded width: 288px
- Collapsed width: 92px
- Three-zone anatomy:
  1. Brand/active module
  2. Navigation group list
  3. Shift/user summary

### Sidebar scroll policy
- Top zone always visible.
- Bottom zone always visible.
- Only middle nav list can scroll.
- Full-sidebar long scroll allowed only in extreme-height fallback.

### Topbar
- Sticky, visual height ~72–80px.
- Keep search, live clock, theme toggle, notifications, profile.

### Header/filter action alignment rules
- `PageHeader` action group right-aligned on desktop; wraps in place on smaller widths.
- Primary action remains visible and visually dominant.
- Filter control order is fixed:
  1. Search
  2. Filters
  3. Sort/control utilities
  4. Export/print actions (print/PDF only after CSV removal)

### Responsive fallback rules (explicit)
- ≤1280px: reduce gaps before reducing hierarchy.
- ≤1024px: split panes may stack while preserving priority order.
- ≤768px: body scroll may be used for usability.
- Mobile: critical actions remain directly reachable.

---

## 5) Global Scroll Strategy (Critical)

### Desktop no-scroll zones
- Main shell/body should not become long-scrolling work surface on major operational pages.
- Sidebar frame and topbar remain stable.

### Internal-scroll zones (allowed)
- Table bodies
- Side panes/drawers
- Modal bodies
- Recent activity lists
- Notification dropdown content
- Settings tab content
- Secondary bounded panels

### Mandatory rules
- Sticky table header where tables are core.
- Drawer/modal internal content scroll.
- Tablet/mobile can degrade gracefully to body scroll where needed.

---

## 6) Final Page Decisions

## 6.1 App Shell

### Layout
- Keep existing feature set and utility controls.
- Improve visual hierarchy and formal consistency.

### Scroll
- Desktop shell bounded; content internals handle scrolling.
- Sidebar middle-scroll only.

### States/interaction
- Focus states visible and consistent.
- Notification panel internally scrollable and bounded.

---

## 6.2 Dashboard (`/dashboard`)

### Layout
- Header with shift controls + refresh.
- 4 equal KPI cards.
- Main 2-column composition:
  - Left: ~1.6fr (Operator Board focal surface)
  - Right: ~0.95fr stack (Near Cutoff, Action Center, Recent Activity)

### Size/density
- Dashboard frame bounded to avoid desktop body scroll.
- Left board min-height target: 460px at 1366×768.
- Right stack min-height targets:
  - Near Cutoff: 220px
  - Action Center: 180px
  - Recent Activity: 180px
- Shrink secondary before primary if space constrained.

### Scroll
- Left table internal scroll + sticky header.
- Right stack panels internal scroll.

### State system
- Loading: KPI + board skeletons.
- Empty: clear guidance and link to ledger.
- Refreshing: keep prior data visible while showing refresh state.

### Visual rules
- Right side remains secondary.
- Flight imagery supportive, not dominant.

---

## 6.3 Shipment Ledger (`/shipment-ledger`)

### Layout
- Keep Create Shipment CTA.
- KPI + filter strip.
- Main 2-pane split:
  - Left 62–66%: manifest table
  - Right 34–38%: shipment detail panel

### Size/density
- Detail pane min-width target: 360px desktop (avoid <340px).
- Search remains dominant filter element.

### Scroll
- Table body internal scroll + sticky header.
- Detail pane internal scroll.
- Create modal body internal scroll.

### State system
- Loading: table skeleton rows + pane placeholders.
- Empty filter result: actionable guidance.
- Save/upload: clear disabled/in-progress states.

### Interaction polish
- Full-row click target.
- Selected row style dominates hover.
- Save action remains reachable in long detail content.

### CSV removal
- Remove CSV button only.
- Keep PDF/Print action.

---

## 6.4 AWB Tracking (`/awb-tracking`)

### Layout
- Dominant AWB input and lookup controls.
- Action row retained: Track, Print, Copy Link, Report Issue.
- Main result left + compact right (Recent Searches + Quick Summary).

### Timeline requirements (hard)
Required status sequence remains explicit:
1. Received
2. Sortation
3. Loaded to Aircraft
4. Departed
5. Arrived

Each step must show timestamp (or explicit pending state).

### Scroll
- Result/timeline region internal scroll when long.
- Right-side recent/summary panels internal scroll.

### Not-found behavior (hard)
- Human-friendly, non-technical copy.
- Practical next actions:
  - check AWB format
  - re-check digits
  - contact supervisor when expected inbound is missing

### State system
- Loading localized to result area (lookup controls stay stable).
- Action confirmations shown in-context.

### Interaction polish
- Active/completed/pending states differ by more than color alone.
- Timestamp readability must hold in compact widths.

---

## 6.5 Flight Board (`/flight-board`)

### Layout
- KPI + compact filters.
- Main split:
  - Left 58–62% flight list/table
  - Right 38–42% selected flight detail

### Size/density
- Left list remains primary surface.
- Near-cutoff cards stay compact/secondary.
- Selected detail min-width target: 380px desktop.

### Scroll
- Left internal scroll + sticky header.
- Right internal scroll.

### State system
- Loading: list/detail skeletons.
- Empty: clear filter-reset guidance.
- Detail empty shown only when no selection.

### Interaction polish
- Selection state obvious in table and card contexts.
- Hover subtle; selected state always stronger.

---

## 6.6 Activity Log (`/activity-log`)

### Layout
- Formal audit-viewer tone.
- KPI + filters + full-width dense table.

### Size/density
- Medium-compact density, readable description.
- Description supports truncation + multiline fallback pattern.

### Scroll
- Table internal scroll + sticky header.

### State system
- Loading skeleton rows.
- Empty filter result with widening guidance.

### Interaction polish
- AWB/target identifiers may use monospace emphasis.
- Keep calm, non-flashy hover.

### CSV removal
- Remove CSV action only.
- Keep PDF/Print action.

---

## 6.7 Reports (`/reports`)

### Layout
- Keep summary KPI row.
- Convert to print/report center with two cards only:
  - Shipment PDF/Print
  - Activity PDF/Print

### Size/density
- Cards balanced in visual weight.
- Concise action-oriented supporting copy.

### Scroll/state
- Standard frame; no unnecessary long scroll.
- Loading metrics must not cause large layout shift.

### CSV removal
- Remove all CSV cards and CSV copy.

---

## 6.8 Settings (`/settings`)

### Layout
- Stable 2-column settings workspace:
  - Left tab rail: 260–280px
  - Right active content pane: flexible

### Size/density
- Tab labels remain readable in dense mode.
- User table/invite forms avoid cramped fields.
- Toggle cards consistent height/rhythm.

### Scroll
- Left rail sticky.
- Right content internal scroll.
- Large form/table sections internally bounded.

### State system
- Save operations disable relevant controls and show clear result.
- Empty team state (if encountered) shows invite-first action.

### Interaction polish
- Edit-in-row save/cancel affordance explicit.
- Preview interactions stay scoped and non-destructive.

---

## 6.9 Login and About Us alignment

### Login
- Keep split layout and demo credentials.
- Tone down marketing intensity relative to operational pages.

### About Us
- Keep route/content; align spacing and hierarchy to formal system.

### Fallback
- Tablet can stack auth split with login form first.
- About grids collapse progressively while preserving heading-first flow.

### Visual don’t (explicit)
- No oversized hero intensity beyond operational visual language.
- No strong decorative gradient escalation.

---

## 6.10 Page-level loading/skeleton guidance

- Dashboard: KPI + table + side-card skeletons.
- Shipment Ledger: table rows + detail pane placeholders.
- AWB Tracking: localized result placeholder; controls fixed.
- Flight Board: list/detail skeletons.
- Activity Log: dense row skeletons with sticky header retained.
- Reports: lightweight KPI placeholders.
- Settings: section-level placeholders without rail shift.

---

## 7) Component Standardization Contracts

Standardize these components:
- `AppShell`
- `PageHeader`
- `OpsPanel`
- `SectionHeader`
- `StatCard`
- `FilterBar`
- `EmptyState`
- `StatusBadge`

### Contract detail
- `AppShell`
  - anatomy: sidebar top/middle/bottom, sticky topbar, bounded content
  - contract: desktop stability + internalized scroll
- `PageHeader`
  - anatomy: eyebrow (optional), title, subtitle, action cluster
  - contract: hierarchy and action alignment consistent across pages
- `OpsPanel`
  - anatomy: bounded bordered panel with consistent radius/padding
  - contract: predictable internal layout rhythm
- `FilterBar`
  - anatomy: ordered control slots with baseline alignment
  - contract: search dominance where present
- `StatCard`
  - anatomy: label, main value, supporting note
  - contract: equal-height behavior in row groups
- `EmptyState`
  - anatomy: icon, title, guidance copy, optional action
  - contract: must provide operational guidance
- `StatusBadge`
  - anatomy: label + semantic styling cues
  - contract: semantic readability not color-only

---

## 8) CSV Export Removal Plan (Only)

### Remove from UI
- Shipment Ledger CSV action/button.
- Activity Log CSV action/button.
- Reports CSV cards/copy.

### Remove from API
- `src/app/api/exports/shipments/route.ts`
- `src/app/api/exports/activity-log/route.ts`

### Keep intact
- Print/PDF surfaces:
  - `src/app/exports/shipments/page.tsx`
  - `src/app/exports/activity-log/page.tsx`
- Upload attachment handling, including CSV file MIME support for shipment documents.

---

## 9) File Mapping (Planned Changes)

### Core
- `src/app/globals.css`
- `src/components/app-shell.tsx`
- `src/components/ops-ui.tsx`
- `src/components/status-badge.tsx` (only if needed for semantic-state accessibility)

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

### CSV endpoint cleanup
- `src/app/api/exports/shipments/route.ts` (remove)
- `src/app/api/exports/activity-log/route.ts` (remove)

### Existing print pages retained
- `src/app/exports/shipments/page.tsx`
- `src/app/exports/activity-log/page.tsx`

---

## 10) Regression Risks and Controls

1. Feature loss during redesign
   - Preserve existing handlers/flows per page.
   - No backend contract changes except CSV endpoint removal.

2. Desktop scroll regressions
   - Enforce bounded containers + internal overflow.
   - Verify 1366/1440/1536 desktop behavior.

3. Sidebar collapsed usability regression
   - Preserve active-state clarity, icon legibility, bottom shift summary.

4. AWB timeline clarity regression
   - Preserve required sequence and timestamp visibility.

5. AWB not-found messaging regression
   - Keep human-friendly operator guidance.

6. Attachment regression for CSV files
   - Keep upload MIME behavior intact.

7. Visual inconsistency drift
   - Token/panel/component standardization before page polish.

8. Header/filter action hierarchy drift
   - Enforce action order/alignment contract.

9. Tablet fallback crowding
   - Enforce explicit stack/fallback at 1024 and 768 breakpoints.

---

## 11) Acceptance Checklist (Final)

1. All existing non-CSV features still work.
2. CSV export UI removed from Shipment Ledger, Activity Log, Reports.
3. CSV export API routes removed and unreferenced.
4. Print/PDF flows fully functional.
5. Dashboard reads as enterprise control room.
6. Corporate blue system is calm/formal/consistent.
7. Desktop layout stable for long operator sessions.
8. Sidebar permanent/collapsible remains highly usable.
9. Main shell/big layout areas do not long-scroll on desktop.
10. Only secondary bounded regions scroll internally.
11. AWB timeline keeps required statuses and timestamps.
12. AWB not-found remains human-friendly and actionable.
13. Shipment Ledger remains productivity-first split workflow.
14. Settings remains structured with stable tab rail/content pane.
15. Activity Log remains dense-formal and quickly scannable.
16. Reports remains useful after CSV removal.
17. No major regression in auth/roles/theme/notifications/auto-refresh/uploads.
18. Build/type/lint sanity checks pass for modified areas.
19. Tablet fallback at 1024 and 768 preserves hierarchy/usability.
20. Component contracts enforced consistently across pages.

---

## 12) Implementation Order (Approach A)

1. Shell + global layout rules
2. Design tokens / spacing / panel system
3. Standardize core components
4. Implement per core page
5. Remove CSV export from UI + related APIs
6. Final consistency pass + build sanity check

### Done-definition for execution
- No intermediate half-finished visual mode.
- Cross-page consistency is enforced in each phase.
- Final pass includes visual consistency audit + functional sanity checks.

---

## 13) Do/Don’t Quick Visual Guide

### Do
- Keep hierarchy scannable in 2–3 seconds.
- Keep primary working surfaces dominant.
- Keep spacing rhythm balanced and formal.

### Don’t
- Don’t let desktop body-level work-page scroll return.
- Don’t use flashy gradients/neon/glass-heavy styling.
- Don’t hide critical actions behind deep menus.
- Don’t reduce AWB timestamp prominence.

---

## 14) Execution Ambiguity Policy

If ambiguity occurs, resolve in this order:
1. operator task speed,
2. data readability,
3. component contract consistency,
4. non-negotiable constraints.

No ambiguity may be resolved by removing non-CSV features.

---

## 15) Readiness Gate

This spec is implementation-ready for one cohesive Approach A execution cycle.