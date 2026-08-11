# UI/UX Design Requirements — TotalTaxi

What the current build has (`client/src/pages/*`, `client/src/components/*`) is a functional skeleton: inline `style={{...}}` objects duplicated per page, no design tokens, no responsive breakpoints, no toasts, no loading skeletons. It's enough to prove the workflow works (see the browser walkthrough in this session), but not enough to hand to real employees, managers, and HR staff. This doc specifies what's needed to close that gap, organized so it can drive an actual design pass rather than read as generic advice.

Every section below is anchored to a concrete screen or role in *this* app — not a generic UI checklist.

---

## 1. Who actually uses this, and what that demands

Four distinct roles use the same app with very different needs (spec section 4):

| Role | Primary screens | Design implication |
|---|---|---|
| Employee | New Request, My Requests | Form has to be fast on a phone — someone staying late for overtime is filling this out tired, possibly one-handed, possibly on the office wifi at 18:45. |
| N+1 Manager | Approvals | Interruption-driven — they land here from a notification, need to approve/reject in seconds, not hunt for the request. |
| ManCom member | Approvals + work-attendance clearance | Same as above, plus the two-gate G-reason flow (attend-work clearance vs. booking approval) must read as clearly *two different actions*, not one confusing double-approval. |
| HR Manager | HR Monitoring | Data-dense, spreadsheet-adjacent work: batch import, matching, reconciliation. This is the one screen that should feel like a tool, not a consumer app. |

**Necessity: design each screen for its role's context, not one generic "app" look.** The booking form optimizes for speed and low cognitive load; HR Monitoring optimizes for information density and control.

---

## 2. Design system foundation (currently missing entirely)

Right now every page defines its own `btn()`, `input`, `table`, `td`, `th` style objects — five slightly-different button styles, hardcoded hex colors repeated across files. This is the single highest-leverage fix.

**Necessity:**
- **Design tokens** (CSS variables or a theme object): a spacing scale (4/8/12/16/24/32), a type scale (label/body/heading sizes already informally used — 11/12/13/14/16/18/22px — should be named, not ad hoc), and a color palette with **semantic** roles, not just hex values: `--color-status-pending`, `--color-status-approved`, `--color-danger`, `--color-primary`, etc. (`StatusBadge.tsx` already has the right *idea* — 10 status colors — but they're a local object, not shared tokens.)
- **A small shared component kit**, extracted once, reused everywhere: `<Button variant="primary|danger|success|neutral">`, `<TextInput>`, `<Select>`, `<Card>`, `<Table>`. Every page currently reimplements these.
- **Dark mode**: not present at all today. Given this may run inside the eventual modular HR platform (which will have its own shell/theme), the module's components should consume theme tokens rather than hardcode `#fff`/`#111827`, so they inherit whatever theme the host platform sets.

---

## 3. Forms (New Request page — Appendix 1 digitised)

This is the highest-traffic screen and currently the weakest UX:

- **Inline validation, not submit-time errors.** Right now `journeyFrom`/`journeyTo`/date/time are only validated by native HTML `required` + a single error paragraph after submit. An employee filling this out under time pressure (they're literally staying late) needs field-level feedback as they go.
- **Smart defaults**: `journeyFrom` should default to a known office location (or the employee's usual site) rather than a blank field every time — most trips originate from the same place.
- **Reason-code picker as cards, not a bare `<select>`.** Eight reasons with meaningfully different consequences (declaration requirement, ManCom approval, work-attendance gate) buried in a dropdown is easy to misuse. A short list of labeled options with the description always visible (not hidden until selected) reduces wrong-reason submissions — which matters because reason code drives the entire approval routing.
- **Progressive disclosure that's already half-built**: the justification field (reason H) and the ManCom-approval banner already show/hide conditionally — good pattern, needs to extend to date/time constraints too (e.g., surface the §3.3 booking deadline *before* submission, not just as a `lateBooking` flag after the fact).
- **Autosave the draft.** The form currently only persists on "Save Draft" click; if the employee's tab crashes or they navigate away mid-fill, it's gone. Given the target user is often filling this out while also trying to leave the office, this is a real loss scenario, not a hypothetical.
- **Time input UX**: native `<input type="time">` renders inconsistently across browsers (visible in the Chromium screenshot — AM/PM segments). Given trips are often evening/night, a 24-hour-clock-friendly picker avoids AM/PM entry errors on a policy where a wrong hour changes lateness calculations.

---

## 4. Status and workflow visibility (My Requests, Approvals)

The app models a 10-state workflow (`RequestStatus`) with meaningful transitions — this needs to be *visible*, not just color-coded:

- **`StatusBadge` is a good start but needs a companion timeline/stepper**: "Draft → Submitted → Approved → Booked → Completed" as a horizontal progress indicator on each request card, so an employee can see at a glance *where* their request is stuck, not just *what* it currently is.
- **Surface the audit trail** (`AuditEvent` — already captured server-side, not shown anywhere in the UI). For a policy this compliance-sensitive ("who approved what, when"), a collapsible "History" section per request showing the audit log is close to a requirement, not a nice-to-have — it's the digital replacement for the paper form's wet signatures.
- **Actionable empty states.** "No requests yet." is a dead end. It should link directly to "New Request."
- **Reject/cancel need confirmation, not one-click destructive actions.** Currently `Cancel` and `Reject` fire immediately (or immediately once the reason field is non-empty). A lightweight confirm step ("Cancel this request?") prevents accidental loss, especially on the manager's Approvals screen where reject is one click next to approve.

---

## 5. Notification-driven UX (currently absent)

Spec section 6 defines notification triggers (submitted → approver, approaching deadline → both parties, personal-use charge → employee + manager) but nothing in the UI reflects this yet:

- **Badge counts on nav.** "Approvals" should show a count (e.g., a red "3") when items are pending — managers land on this screen reactively, from a notification, and need instant confirmation they're looking at the right thing.
- **Toast confirmations, not silent state changes.** Right now, clicking "Approve" just re-renders the list. A toast ("Request approved — Jean Marie notified") closes the loop for the actor.
- Real notification delivery (email/Teams) is out of scope for the UI itself but the UI needs the *affordances* (badges, toasts) that make the eventual notification system feel connected rather than bolted on.

---

## 6. HR Monitoring (data-dense screen — different rules apply)

This screen is intentionally tool-like, but the current table-based UI has gaps that matter for the actual reconciliation workflow (spec section 5):

- **Sortable/filterable tables.** As invoice batches and requests accumulate month over month, flat tables with no sort/filter/search become unusable within a quarter. This is the one screen where "spreadsheet-grade" interaction (column sort, text filter, status filter) is a functional requirement, not polish.
- **Pagination.** Both the "Booked/completed trips" and "Personal-use charges" tables will grow unbounded; there's no limit or paging today.
- **Bulk actions.** Matching invoice lines one-by-one via a text input for `requestId` (current implementation) doesn't scale past a handful of lines. A searchable combobox (type employee name, see matching candidate requests) replacing the raw-ID text field is close to essential — no HR user should ever need to know or copy-paste a `cuid`.
- **Visual distinction for money.** Amounts, waiting-time charges, and totals are currently plain table cells identical in weight to text fields — for a reconciliation tool, monetary values should be visually distinct (right-aligned, tabular-nums, currency-formatted "Rs 1,234" not raw floats).

---

## 7. Accessibility (not addressed at all currently)

Given this may sit inside a corporate HR platform subject to standard accessibility expectations:

- **Color is not the only status signal.** `StatusBadge` communicates status by background/text color alone — add an icon or text-weight distinction so it doesn't fail for color-blind users.
- **Keyboard navigation and focus states.** None of the current buttons/inputs have visible focus rings (inline styles override browser defaults with no replacement). Every interactive element needs a visible focus state for keyboard-only users (and this is a compliance-adjacent app — auditors may use keyboard nav).
- **Form labels are currently just visual `<label>` wrapping** — good semantically, but error messages need `aria-describedby` linkage to their field, and required fields need `aria-required`, not just a visual asterisk convention (which isn't even present yet).
- **Contrast**: verify the amber/red status badge combos (`#fef3c7`/`#92400e`, `#fee2e2`/`#991b1b`) meet WCAG AA — they're close but should be checked against the actual token values once tokens are defined (§2).

---

## 8. Responsive / mobile (currently desktop-only)

The layout uses a fixed `maxWidth: 1100` container with no breakpoints, and the nav bar (`Layout.tsx`) will overflow on a phone. Given §1's point that employees fill out New Request under time pressure and may well be on a phone rather than at a desk:

- **New Request and My Requests must work at mobile widths** — these are the two screens an employee actually touches. HR Monitoring can reasonably stay desktop-first (spreadsheet-adjacent work isn't done on a phone).
- **Nav collapses to a menu below ~768px** instead of the current flex row that will wrap awkwardly.

---

## 9. Localization / regional conventions (Mauritius-specific)

- **Currency formatting**: amounts currently render as raw floats (`450`, `Rs 0`). Should consistently format as `Rs 1,234.00` throughout (HR Monitoring totals, personal-use charges).
- **Date/time format**: currently mixes `toLocaleDateString()` (locale-dependent, ambiguous MM/DD vs DD/MM) — should be pinned to `en-MU` or an explicit `DD/MM/YYYY` format to match the source policy document's own date convention (`16/06/2026`).
- **Phone number field** (`taxiContactNumber`) has no format hint or validation — Mauritius numbers have a specific format (`+230 5xxx xxxx`) worth validating/masking given this field feeds directly into a real taxi dispatch call.

---

## 10. What NOT to over-invest in yet

- **The "logged in as" picker is a deliberate stand-in for real auth** (see spec section 8) — don't polish it as a permanent feature; design it to be trivially removable once the platform's real Auth module exists.
- **Don't build a custom design system from scratch** if this module is joining a larger modular HR platform — the tokens/component-kit in §2 should be scoped so they can be swapped for the platform's shared design system later rather than becoming a second competing one.

---

## Priority order (if resourcing this incrementally)

1. Design tokens + shared component kit (§2) — everything else compounds on top of this.
2. Forms UX on New Request (§3) — highest-traffic, highest-friction screen today.
3. Status visibility + audit trail surfacing (§4) — closes the compliance/trust gap.
4. Accessibility basics: focus states, contrast, ARIA (§7) — cheap once tokens exist, expensive to retrofit later.
5. HR Monitoring data-density improvements (§6) — matters once real data volume shows up, not before.
6. Responsive/mobile (§8) and localization (§9) — polish pass once the core flows are solid.
