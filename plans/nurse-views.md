# Nurse dashboard: Jira-style switchable views

## Goal
Make the Nurse screen work for 100+ waiting patients. Add a Jira-style view switcher with three views: **List** (dense table), **Grid** (token heatmap) and **Board** (the current 3-lane Kanban). The worklist sidebar, the patient drawer and the fail-safe mode stay the same in every view.

## Scope
Only `src/App.tsx`, inside the `Nurse` component plus new helper components. No changes to `engine.ts`.

## Shared header (all views)
- Title and count: "Waiting area · N waiting".
- **View switcher**: a segmented control in Jira style with icons and labels: `List` (default), `Grid`, `Board`. Each button is at least 48px tall. The chosen view is saved in `localStorage` (`opd.nurseView`).
- **Filter bar** shared by all views:
  - search by token or complaint text
  - tier chips (Immediate, Soon or Routine, multi-select, with counts)
  - flag chips: "Needs action" (unacknowledged Immediate, pendingSuggestion or unverified), "Vitals pending", "Override"
- The fail-safe button stays where it is.
- One memoised `filtered` list, computed as `sortQueue(patients.filter(...), results)`, feeds all three views.

## Immediate strip (List and Grid views)
A sticky red band pinned above the view. It shows every Immediate patient as a compact pill: token, age/sex, wait time and a short reason. Unacknowledged patients pulse. Clicking a pill opens the drawer. If there are no Immediate patients, it shows a slim "No Immediate patients" line. It ignores the tier filter so the red band can never be hidden. The Board view leaves it out because its Immediate lane already serves that purpose.

## View A: List (dense priority table)
- Rows are 48px tall and sorted by tier, then arrival. Columns:
  - tier dot and glyph
  - Token (mono, bold)
  - Age/Sex
  - Wait (turns red past the tier's target wait, if one exists; otherwise just the time)
  - Reason (truncated, with the full text in `title`)
  - Vitals summary (SpO₂, BP, NEWS2) or "pending"
  - Flags (compact icons/tags: override lock, new suggestion, low confidence, unverified)
- Group headers per tier (sticky, with counts) are **collapsible**. Immediate is always expanded and Routine starts collapsed when there are more than 40 patients. Collapsed state lives in local state.
- A row click opens the drawer. The selected row gets a ring. Unacknowledged Immediate rows get a left red border and pulse.
- Up/down arrow keys move the selection and Enter opens the drawer (nice for demos).

## View C: Grid (token heatmap)
- Responsive grid of square tiles: `grid-cols-[repeat(auto-fill,minmax(64px,1fr))]`.
- Each tile shows the token number, filled with the tier's soft colour, a tier border and the tier glyph in a corner, so it doesn't rely on colour alone.
- Small corner dots for flags (override or new suggestion). Tiles turn more saturated as wait grows: wait ÷ target, clamped to 3 steps.
- Sorted by tier, then arrival, with a small tier divider label. Hovering or focusing a tile shows a tooltip (reason plus wait). Clicking opens the drawer.
- A legend row shows the tier colours and the saturation meaning.

## View B: Board (existing)
The current Kanban code moves unchanged into a `BoardView` component that uses `filtered`. Each lane gets a "Show more" cap at 15 cards so it doesn't render 100 cards.

## Component structure
- `Nurse`: header, switcher, filters, strip, the active view, sidebar and drawer
- `ViewSwitcher`, `NurseFilters`, `ImmediateStrip`, `ListView`, `GridView`, `BoardView`
- Every view takes `{ patients, results, now, selected, onSelect }`.

## Edge cases
- If filters return zero patients, show an empty state with a "Clear filters" button.
- The drawer can still be open when its patient is filtered out. Keep it open.
- Fail-safe mode overrides every view.
- Hindi labels on the tier headers come from the existing `TIER[t].hi`.

## Verification
- Run `pnpm build` (tsc) and confirm it passes.
- Manual check: generate or seed 100+ patients if the demo seed has fewer. Add a "Load 120 demo patients" button under Admin if no seed exists. Then switch between views, filter, open the drawer, and confirm the Immediate strip stays visible.
- Confirm the 15 test vignettes are unaffected, since the engine is untouched.
