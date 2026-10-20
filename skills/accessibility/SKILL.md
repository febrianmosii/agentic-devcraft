---
name: accessibility
description: >-
  Makes UI code usable with a keyboard, a screen reader, zoom and low vision:
  semantic HTML before ARIA, focus management, WCAG 2.2 AA contrast, labelled
  forms with announced errors, accessible names for icon buttons, and honest
  verification (a manual keyboard pass, not just an automated scan). Use when
  building or changing a component, form, modal, dropdown, menu, tabs, table
  or page template, when asked about a11y, WCAG, screen reader, keyboard,
  focus, contrast or aria, or when reviewing front-end code for accessibility.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Accessibility

## Purpose

Generated UI code tends to be `div` with `onClick`, hover-only menus, a
placeholder standing in for a label and a confident sentence saying it is
"accessible". None of that works with a keyboard, a screen reader or 200%
zoom, and the claim hides the gap until a user or an audit finds it. This
skill makes the markup carry its own semantics, keeps every interaction
reachable without a mouse, and makes the report say what was actually tested.
The baseline is WCAG 2.2 Level AA.

## When to use

- Writing or changing any component with interaction: buttons, links, menus,
  dialogs, dropdowns, tabs, accordions, tooltips, toasts, data tables.
- Forms: fields, validation, error display, multi-step flows.
- Page templates, navigation, routing in SPAs, dynamic content updates.
- Styling work that touches colour, focus styles, motion, or layout at small
  widths.
- Explicit requests: "a11y", "WCAG", "screen reader", "keyboard navigation",
  "focus", "contrast", "aria", "accessible".

Not the right skill for backend code or CLI tools. For the limits of the
change itself, `scope-control` still applies: fix the component you were
asked to touch, note the rest.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Use the project's existing component library and design-system patterns before writing custom ARIA.**
  Prevents: a second, worse dialog or select next to the one the project already tested; inconsistent keyboard behaviour across the app.
  Applies: any widget the project already has (`Dialog`, `Select`, `Listbox`, `Menu`, `Tabs`, `Tooltip`, headless-UI primitives, `<dialog>` wrappers).
  Exception: no such component exists, and the report says what was searched.
  Verify: the diff imports the project's component or the report names the search (grep for `role="dialog"`, `Dialog`, `Listbox`, the UI package) that came up empty.

- **Native semantic elements first; ARIA only where HTML has no element.**
  Prevents: `div`-buttons with no keyboard support, headings skipped for styling, lists built from `div`s, `role="button"` on an `<a>` that navigates.
  Applies: all markup. Use `<button>` for actions, `<a href>` for navigation, `<h1>`-`<h6>` in document order without skipping levels, `<nav>`/`<main>`/`<header>`/`<footer>`/`<aside>` landmarks, `<ul>`/`<ol>`/`<table>` for lists and tabular data.
  Exception: a widget with no native equivalent (tabs, combobox, tree) built on the pattern in [references/component-patterns.md](references/component-patterns.md).
  Verify: no `onClick` on a non-interactive element; no `role` that duplicates a native element; heading outline reads as a table of contents.

- **Every interaction works with the keyboard alone and shows a visible focus indicator.**
  Prevents: users who cannot use a mouse being locked out; focus disappearing after `outline: none`; focus trapped inside a widget with no way out.
  Applies: every interactive element and custom widget; Tab order follows visual order; Escape closes any overlay; custom widgets implement the arrow/Home/End/Enter/Space handling their pattern expects.
  Exception: none for operability; a custom focus style may replace the browser outline if it meets 3:1 contrast against adjacent colours.
  Verify: Tab through the feature with the mouse unplugged in your head: every control reached, activated, and left; focus always visible; Escape closes what Enter opened.

- **Manage focus when the UI changes under the user.**
  Prevents: focus left on a removed element (screen reader goes silent), dialogs that open behind the cursor, forms that fail with no indication where.
  Applies: dialog open (focus moves inside) and close (focus returns to the opener); SPA route change (focus the new page's heading or main region); failed submit (focus the first invalid field or an error summary that links to the fields); content removal under focus.
  Exception: never move focus the user did not ask for (autofocus on load of a content page, focus jumping on a background fetch).
  Verify: after each open/close/navigate/submit-error, the focused element is the one named above (`document.activeElement` in a test or devtools).

- **Every form control has a programmatically associated label and exposed state.**
  Prevents: screen readers announcing "edit text" with no name; errors that are visible but never announced; required fields discovered only on submit.
  Applies: `<label for>` or wrapping `<label>` (or `aria-labelledby` for the project's input component); errors in an element referenced by `aria-describedby` with `aria-invalid="true"` on the field; `required` or `aria-required`; related controls in `<fieldset>` with `<legend>`.
  Exception: a visually hidden label is acceptable when the design has none; a placeholder is not a label.
  Verify: devtools accessibility pane shows a non-empty name for every field; the error text is in the field's description; submitting an invalid form announces or focuses the error.

- **Meet WCAG 2.2 AA contrast and never rely on colour alone.**
  Prevents: text unreadable in sunlight or for low-vision users; "errors are red" with no icon or text; status conveyed by a coloured dot.
  Applies: text 4.5:1 (3:1 for large text: 24px, or 18.66px bold); UI component boundaries, focus indicators and meaningful graphics 3:1; every colour-coded state also has text, an icon or a pattern.
  Exception: disabled controls, logos, and pure decoration.
  Verify: ratios checked with a tool (devtools contrast picker, `axe`, a contrast checker) and the pair/ratio noted in the report; with colour removed (grayscale), the state is still distinguishable.

- **Never claim "accessible" or "WCAG compliant" from an automated scan alone, or without one.**
  Prevents: a false promise to the user; shipping a widget that passes `axe` and cannot be opened with a keyboard.
  Applies: every report on UI work. Automated tools (axe, Lighthouse, eslint-plugin-jsx-a11y) catch a subset of issues, mostly missing names and contrast; keyboard operability, focus order and announcement quality need a manual pass.
  Exception: none; if the manual pass could not run, say so and say what was checked instead.
  Verify: the report lists the scan command and result, and the manual keyboard pass steps from [references/manual-test-pass.md](references/manual-test-pass.md) with what happened.

### SHOULD

- **Give images and icon buttons a correct accessible name.**
  Prevents: "image", "button" and "chevron-right.svg" being all a screen reader user hears.
  Applies: `alt` that states what the image conveys, `alt=""` (not omitted) for decorative images; icon-only buttons get text via `aria-label`, `aria-labelledby` or visually hidden text; SVG icons inside such buttons get `aria-hidden="true"`.
  Exception: an image whose adjacent text already says the same thing gets `alt=""`.
  Verify: the accessibility tree shows a meaningful name for every button and informative image, and no name containing a file extension.

- **Use live regions sparingly and hide hidden content fully.**
  Prevents: a chatty page that announces every keystroke, and "hidden" content that is still read or focusable.
  Applies: `aria-live="polite"` on one container for result counts, save status and toasts; `role="alert"` only for errors that need interruption; hidden content uses `hidden`, `display: none` or `inert`, not `opacity: 0` or `visibility` tricks that leave it in the tab order.
  Exception: visually hidden text that is meant to be read (`.sr-only`) stays in the tree by design.
  Verify: one live region per area, text changes only when content changes; no focusable element reachable inside collapsed or off-screen content.

- **Put ARIA attributes only on elements that support them.**
  Prevents: `aria-label` on a `<div>` or `<span>` with no role (ignored by most screen readers), `aria-expanded` on a link, `role="menu"` for site navigation.
  Applies: `aria-label` only on interactive elements, landmarks, images or roled elements; state attributes matched to the role in the pattern reference.
  Exception: none; use visible text or a roled wrapper instead.
  Verify: no `aria-*` on a generic element without a role; `axe` reports no `aria-allowed-attr` or `aria-allowed-role` violations.

- **Make hover, pointer and motion-dependent behaviour available another way.**
  Prevents: tooltips and menus that only open on hover, drag-only reordering, and animations that cause discomfort.
  Applies: hover-revealed content also shows on focus and can be dismissed with Escape; drag operations have a button or keyboard alternative; animation and auto-play respect `prefers-reduced-motion: reduce`.
  Exception: a cosmetic hover highlight with no content in it.
  Verify: every hover-only affordance reached by Tab; `prefers-reduced-motion` emulated in devtools stops non-essential motion.

- **Keep targets and layout usable at touch size, 200% zoom and 320px width.**
  Prevents: tap targets that cannot be hit, horizontal scrolling and clipped content when text is enlarged.
  Applies: targets at least 24 by 24 CSS pixels (WCAG 2.2 AA; 44 by 44 for primary touch actions where the design system allows); no fixed heights that clip text; text in relative units or at least not blocking zoom.
  Exception: inline links in running text.
  Verify: the page at 320px width and at 200% browser zoom shows all content without two-dimensional scrolling.

- **Add `autocomplete` to fields that collect the user's own data.**
  Prevents: users with motor or cognitive impairments retyping name, email, address and card fields.
  Applies: `autocomplete="email"`, `"name"`, `"tel"`, `"street-address"`, `"postal-code"`, `"cc-number"` and the other tokens in the HTML spec.
  Exception: fields that are not about the user (a search box, an admin editing someone else's record).
  Verify: each personal-data field has the matching token.

### CONSIDER

- **Testing a custom widget with a real screen reader** (VoiceOver on macOS, NVDA on Windows) when the project has no equivalent component and the pattern is non-trivial.
- **Adding an `axe` assertion to the project's existing component tests** when a test runner is already in place, so regressions are caught without adding a new tool.
- **A skip link to `<main>`** when the page has a large repeated header or navigation and the project does not already provide one.
- **A visually hidden utility class** when the project lacks one and you are about to write `aria-label` on a third element.

## Workflow

- **Understand:** find the project's UI primitives and conventions first (UI package, headless library, `.sr-only` class, focus-ring tokens, existing dialogs and selects). Identify which WCAG pattern the task maps to (dialog, listbox, tabs, form, live region). Note the automated check the project already runs (`eslint-plugin-jsx-a11y`, `axe` in tests, Lighthouse in CI).
- **Plan:** choose native element or existing component; only then a custom pattern. Write down the keyboard contract (what Tab, Enter, Escape, arrows do) and the focus moves (open, close, error) before coding.
- **Implement:** semantics and keyboard first, styling second. Add ARIA state as the widget's state changes, not as decoration. Reuse the project's focus style and hidden-text utility.
- **Verify:** run the automated check that exists, then the manual pass in [references/manual-test-pass.md](references/manual-test-pass.md): keyboard-only, zoom and width, grayscale, and a screen reader when the widget is custom. Record what you did and what you saw.
- **Report:** the pattern used and why, the keyboard contract, the contrast pairs checked, the scan command and result, the manual pass steps and findings, and what was not tested.

## Examples

A clickable `div` and an icon button, before:

```jsx
<div className="btn" onClick={save}>Save</div>

<span className="icon-btn" onClick={close}>
  <CloseIcon />
</span>
```

After:

```jsx
<button type="button" onClick={save}>Save</button>

<button type="button" onClick={close} aria-label="Close dialog">
  <CloseIcon aria-hidden="true" />
</button>
```

The `div` was unreachable by Tab, did not respond to Enter or Space, and was
announced as plain text. The icon `span` had no name at all. `<button>` gives
all of that for free; the only ARIA left is a name for the icon-only button
and hiding the icon so the name is not read twice.

A modal, before: a fixed-position `div` appended to the page, no focus move
on open, no Escape handling, and focus left on `document.body` after close.
After: the project's `Dialog` component (or `<dialog>` with `showModal()`),
which moves focus to the first control or heading, keeps Tab inside, closes
on Escape, and returns focus to the button that opened it.

Full scenario: [examples/accessibility/product-filter-dropdown.md](../../examples/accessibility/product-filter-dropdown.md).

Expected keyboard behaviour and ARIA for dialog, menu, tabs, combobox,
disclosure and toast: [references/component-patterns.md](references/component-patterns.md).

## Anti-patterns

- **Div soup.** `div`s with `onClick`, `role="button"` added later, `tabindex="0"` sprinkled to make Tab reach them. Correction: `<button>`, `<a href>`, `<input>`; roles only for patterns HTML lacks.
- **ARIA as paint.** `role="navigation"` on a `<nav>`, `aria-label` on a `<span>`, `aria-expanded` that never changes. Correction: remove redundant roles; put state attributes where the role allows them and update them with the state.
- **Focus outline: none.** A global reset that removes the focus ring "for design" with no replacement. Correction: style `:focus-visible` with a ring that has 3:1 contrast; never leave focus invisible.
- **Placeholder as label.** `<input placeholder="Email">` with no `<label>`; the hint vanishes on typing and is not a name. Correction: a real label, visually hidden if the design insists.
- **Contrast by eye.** "Light grey on white looks fine". Correction: measure the ratio; 4.5:1 for body text, 3:1 for large text and component boundaries.
- **Silent update.** Results, counts or save status change with no announcement, so a screen reader user does not know anything happened. Correction: one polite live region for the status text, or move focus to the new content when that is the expected flow.
- **Hover-only.** Menus, tooltips and action buttons that appear only on mouse hover. Correction: show on focus as well, keep them dismissible, make the action reachable by Tab.
- **Scan equals compliant.** "Ran axe, zero violations, the page is WCAG compliant". Correction: report the scan as a scan; add the manual keyboard pass; say "no issues found in X and Y", not "compliant".

## Verification checklist

- [ ] The project's existing component or a native element was used, or the search for one is reported.
- [ ] No `onClick` on non-interactive elements; headings in order; landmarks present on page-level changes.
- [ ] Every control reachable and operable by keyboard; focus visible everywhere; Escape closes overlays; no trap.
- [ ] Focus moves on dialog open, returns on close, lands on the first error after a failed submit, and is not moved otherwise.
- [ ] Every field has an associated label; errors use `aria-describedby` and `aria-invalid`; groups use `fieldset`/`legend`.
- [ ] Contrast ratios measured for new text, borders and focus rings; no colour-only state.
- [ ] Images have correct `alt`; icon buttons have names; hidden content is out of the tab order.
- [ ] Works at 320px width and 200% zoom; hover content has a focus equivalent; reduced motion respected.
- [ ] Automated check run with the actual command and result in the report.
- [ ] Manual keyboard pass run and its steps and findings are in the report.

## Output

The report names the pattern and component used, the keyboard contract
implemented, the focus moves, the contrast pairs checked with their ratios,
the automated command and its output, and the manual steps performed with
what was observed. It states what was not tested (screen reader, mobile,
specific browsers). It never calls the work "accessible" or "WCAG compliant"
on the strength of a scan, and never reports a scan or a manual pass that did
not happen.
