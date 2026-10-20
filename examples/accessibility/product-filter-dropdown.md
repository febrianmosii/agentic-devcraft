# Building a product filter dropdown

**Skill:** accessibility
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript.

## Task

> Add a "Category" filter to the products page. It should be a dropdown
> above the grid; picking a category reloads the results below without a
> full page load. Match the look of the existing filters.

The project is a React/TypeScript storefront. It already has a `Select`
component (built on a headless listbox library) used in the checkout
address form, a `.sr-only` utility class, a `--focus-ring` token, and an
`axe` assertion in several component tests. The page has a `<p>` showing
"Showing 48 products" above the grid.

## Without the skill

The agent writes a new `CategoryDropdown` component from scratch:

- A `<div className="dropdown">` with `onClick` toggles an options panel;
  options are `<div>`s with `onClick`, highlighted on `:hover` only.
- The trigger shows the placeholder text "Category" in light grey
  (`#B0B4BA` on white) instead of a label; once a value is chosen the
  placeholder disappears and nothing names the control.
- There is no keyboard handling. Tab skips the whole widget because nothing
  is focusable; Escape does nothing; focus stays wherever it was.
- The selected option is indicated only by a blue background.
- Choosing an option fetches and replaces the grid. The "Showing 48
  products" text updates visually, with nothing to tell a screen reader
  user it changed.
- `outline: none` is added to the trigger "to match the other filters"
  (the other filters use the `--focus-ring` token, which the agent did not
  look at).

Report: "Added an accessible category filter dropdown with smooth hover
states. Results update dynamically. Tested and working."

No automated scan or keyboard check was run; "accessible" is asserted, not
observed. A keyboard user cannot reach the filter; a screen reader user
cannot name it, operate it, or learn that the results changed.

## With the skill

The agent reads the page and searches the project for an existing pattern
before writing anything:

> Found `src/components/ui/Select.tsx` (headless listbox: label, keyboard
> and `aria-activedescendant` handled), used in `AddressForm`. Found
> `.sr-only` and `--focus-ring`. The results count `<p>` is a good host for
> a polite live region. Plan: reuse `Select`, add a visible label, wire the
> count paragraph as `aria-live="polite"`, no custom ARIA.

Implementation, in the same style as the checkout usage:

```tsx
<Select
  label="Category"
  value={category}
  onChange={setCategory}
  options={categories}
/>

<p id="results-status" aria-live="polite" aria-atomic="true">
  Showing {products.length} products
</p>
```

The `Select` renders a `<label>` associated with a `<button>` trigger
(`aria-haspopup="listbox"`, `aria-expanded`), a `role="listbox"` popup with
`role="option"` items and `aria-selected`, and the project's focus ring.
The agent adds a check mark icon next to the selected option so selection
is not colour-only, and confirms the trigger text shows the chosen value.

Verification, as recorded in the report:

> Automated: `npm test -- ProductsPage` (existing `axe` assertion, 3 tests
> passed, 0 violations).
> Keyboard: Tab reaches the Category trigger after the search box; Enter
> and ArrowDown open the list on the current option; ArrowUp/ArrowDown
> move, Home/End jump, Enter selects and closes, Escape closes without
> changing the value; focus returns to the trigger in both cases; Tab moves
> on to the sort control. No trap.
> Announcement: after selecting "Shoes", VoiceOver read "Showing 12
> products" once.
> Zoom/width: 200% zoom and 320px wide; the filter row wraps, no horizontal
> scroll.
> Contrast: trigger text #1F2937 on #FFFFFF 14.7:1; option text same;
> focus ring uses the existing token (3.9:1 against white, already in use).
> Not tested: NVDA/Windows, mobile Safari.
> Outside the request: none. Noticed, not changed: the sort control next
> to this filter is a hand-rolled `div` dropdown with the same problems the
> skill avoids here; worth a separate ticket.

The report does not say the page is "accessible" or "WCAG compliant". It
says which checks ran and what they showed.

## Why it matters

The first version is a new component that duplicates one the project
already has, and does it worse: unreachable by keyboard, unnamed, hover-only,
colour-only, and silent on update. The word "accessible" in its report is
unverifiable and wrong. The second version reuses the tested component,
adds a label and a live region, makes selection visible without colour,
and reports a specific manual pass plus the automated result, with what was
left untested. A reviewer can check each claim, and a keyboard or screen
reader user can actually filter the products.
