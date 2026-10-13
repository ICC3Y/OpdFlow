# Opdflow: restyle every screen with the GOV.UK Design System

## Goal
Restyle the sign-in, Registration, Nurse, Doctor and Logs screens with the real `govuk-frontend` package. Keep all behaviour, the triage engine, role access and the no-scroll layout at 1366×768.

## Decisions
- **Package:** add `govuk-frontend` (v5) as a dependency and `sass` as a dev dependency. Use the official CSS classes in JSX. Don't add the GOV.UK JS: we're in React, so we'll handle component state ourselves.
- **Palette:** use GOV.UK colours: text `#0b0c0c`, white background, link and focus `#1d70b8`, focus yellow `#ffdd00`, grey borders `#b1b4b6`, and the primary button green `#00703c`. Keep only the three priority colours: Immediate `#D62839`, Soon `#F4A300`, Routine `#1E8449`. Red is still used only for Immediate (GOV.UK error states will use the error style with a text message, not a red tile fill).
- **Typography:** GOV.UK uses the "GDS Transport" font, which isn't licensed for non-government sites. Set `$govuk-font-family` to Inter with Noto Sans Devanagari as a fallback, so the current font wiring stays.
- **Fit:** keep the no-scroll rule. Use GOV.UK small variants (`govuk-button--secondary`, `govuk-checkboxes--small`, `govuk-radios--small`, `govuk-!-font-size-16/19`, and `govuk-!-margin-*` spacing overrides). Keep 48px tap targets on the problem tiles and main buttons.

## Implementation
1. `pnpm add govuk-frontend` and `pnpm add -D sass`.
2. Create `src/govuk.scss`:
   - `$govuk-font-family: "Inter", "Noto Sans Devanagari", sans-serif;`
   - `$govuk-assets-path: "/node_modules/govuk-frontend/dist/govuk/assets/";`, or skip assets because we don't use the crown/fonts
   - `$govuk-new-link-styles: true;`
   - `@import "govuk-frontend/dist/govuk/index";` (silence deprecation warnings with `silenceDeprecations` in `vite.config.ts` under `css.preprocessorOptions.scss`)
   - Add a small set of Opdflow overrides: priority tag colour classes `.app-tier--immediate/soon/routine`, plus compact helpers.
3. In `src/main.tsx`, import `./govuk.scss` before `./index.css`. Remove the old custom palette variables (`#FAF7F2`, navy, teal) from `index.css`, but keep the Tailwind layout utilities (grid, flex, widths and heights for the no-scroll split). Add `govuk-template` / `govuk-template__body` classes to `html` and `body`.
4. Map the app shell and shared components in `src/App.tsx` to GOV.UK components:
   - Header: `govuk-header` with the service name "Opdflow" (no crown). Show the signed-in user and Sign out on the right.
   - Role tabs: `govuk-service-navigation` (fallback: `govuk-tabs__list` styling) with the current item set to active.
   - `TierBadge` → `govuk-tag` plus a priority colour class. Keep the label text ("Immediate" and so on), so colour isn't the only signal.
   - `Chip` → toggle buttons styled as `govuk-button govuk-button--secondary`. When selected, use the `aria-pressed` style: a dark border and a tick.
   - `Section` → `govuk-fieldset` with a `govuk-fieldset__legend--s` legend. No numbers.
   - Text inputs, the token, age and ABHA fields → `govuk-form-group`, `govuk-label`, and `govuk-input govuk-input--width-4/10`.
   - Sex → `govuk-radios--inline govuk-radios--small`.
   - Known conditions and "Looks very unwell?" → `govuk-checkboxes--small`.
   - Register → `govuk-button` (green). Reset or Example → `govuk-button--secondary`. Destructive actions → `govuk-button--warning`.
   - Validation → `govuk-error-summary` at the top of the panel plus inline `govuk-error-message`, shown only on submit.
5. Screens:
   - **Sign-in:** a centred `govuk-width-container` with an `h1.govuk-heading-l`. Show the demo accounts as a `govuk-radios` list or a summary list with a "Sign in" button.
   - **Registration:** keep the 62/38 grid. The problem tiles stay a 4×3 grid of large secondary buttons; keep the EN/हिं toggle as a pair of small secondary buttons. Put the result panel in a `govuk-panel`-style box, or use a `govuk-notification-banner` coloured by priority for the outcome, with Register below it.
   - **Nurse:** queue → `govuk-table` (compact, `govuk-!-font-size-16`), with the token grid as an alternate view. Patient drawer → a side panel that uses `govuk-summary-list` for vitals and history, plus a GOV.UK form for updates.
   - **Doctor:** queue → `govuk-table`; current patient → `govuk-summary-list` with action buttons.
   - **Logs/Admin:** stats as `govuk-heading-xl` numbers with `govuk-body-s` captions (no cards and no borders); audit log → `govuk-table`, scrolling inside its own container while the page itself stays fixed.
6. Remove the old design-system rules that conflict with GOV.UK, such as the 4–6px radius (GOV.UK uses 0px) and the beige background. Keep these rules: no numbered step circles, no empty-state sentences, and no uppercase tracked labels.

## Edge cases
- Devanagari text in GOV.UK type sizes: check the line height on tiles and keep the label to two lines at most.
- The yellow focus state (`#ffdd00`) must stay visible on the priority tag colours.
- Soon (`#F4A300`) tags need black text to meet contrast; Immediate and Routine use white text.
- Sass `@import` deprecation warnings mustn't fail the build.

## Verification
- Run `pnpm build` to check that Sass compiles and TypeScript passes.
- Check each role in the preview at 1366×768, signed in as Asha, Priya and Dr. Mehta. Confirm there's no page scroll on any screen, priority colours appear only on tags and outcomes, and keyboard focus is visible.
- Register the "Example" patient (60M, chest pain with sweating). It should come out as Immediate and appear at the top of the Nurse and Doctor queues.
