# Component patterns: keyboard contract and ARIA

The authoritative source is the WAI-ARIA Authoring Practices Guide (APG)
"Patterns" section. This file is the short version for the widgets agents
build most often. Before any of these, check whether the project already has
the component; if it does, use it and skip this file.

Common to every pattern:

- One Tab stop per composite widget; arrows move inside it (roving
  `tabindex`: the active item has `tabindex="0"`, the rest `-1`).
- Escape closes anything that opened and returns focus to the opener.
- State attributes (`aria-expanded`, `aria-selected`, `aria-checked`) are
  updated with the state, never hard-coded.
- `aria-controls` and `aria-labelledby` reference existing ids.

## Dialog (modal)

Prefer native `<dialog>` with `showModal()`, or the project's `Dialog`.

- Markup: `role="dialog"` (or `<dialog>`), `aria-modal="true"`,
  `aria-labelledby` pointing at the dialog title, optional
  `aria-describedby` for the intro text.
- Open: move focus to the first focusable control, or to the title when the
  first control is destructive. Mark the rest of the page `inert` (or use
  `showModal()`, which does this).
- Keys: Tab and Shift+Tab stay inside; Escape closes.
- Close: focus returns to the element that opened the dialog. If that element
  no longer exists, focus the nearest logical container.
- Do not: stack a second scrollbar, leave background content focusable, open
  on page load without user action.

## Menu and menu button

Use only for application menus (actions on an item). Site navigation is
`<nav>` with a list of links, not `role="menu"`.

- Trigger: `<button aria-haspopup="menu" aria-expanded="false" aria-controls="id">`.
- Container: `role="menu"`; items `role="menuitem"` (or `menuitemcheckbox`,
  `menuitemradio` with `aria-checked`).
- Keys on trigger: Enter, Space, ArrowDown open and focus the first item;
  ArrowUp opens and focuses the last.
- Keys in menu: ArrowDown/ArrowUp move (wrap at ends); Home/End first/last;
  a printable character jumps to the next item starting with it; Enter or
  Space activates; Escape closes and returns focus to the trigger; Tab
  closes and moves on.
- Click outside closes without moving focus elsewhere.

## Tabs

- Container `role="tablist"` with `aria-label` or `aria-labelledby`.
- Each tab: `<button role="tab" aria-selected="true|false" aria-controls="panel-id" id="tab-id" tabindex="0|-1">`.
- Each panel: `role="tabpanel" aria-labelledby="tab-id"`, `tabindex="0"` when
  the panel has no focusable content, `hidden` when not active.
- Keys: ArrowLeft/ArrowRight move between tabs (ArrowUp/ArrowDown for a
  vertical list, `aria-orientation="vertical"`); Home/End; Tab leaves the
  tablist into the active panel.
- Automatic activation (panel changes on arrow) is fine when the panel loads
  instantly; otherwise manual activation with Enter/Space.

## Combobox (select, autocomplete, filter dropdown)

For a plain single choice, use `<select>`. Reach for a combobox only when
filtering, custom option rendering or multi-select is required, and prefer
the project's `Select`/`Listbox`/`Combobox` component over hand-rolled ARIA.

- Input: `<input role="combobox" aria-expanded aria-controls="listbox-id" aria-autocomplete="list" aria-activedescendant="active-option-id">`
  with a `<label>`.
- Popup: `role="listbox"`; options `role="option" id aria-selected`.
  Multi-select: `aria-multiselectable="true"` on the listbox.
- Keys: ArrowDown opens and moves to the first (or next) option; ArrowUp to
  the last (or previous); Enter selects and closes; Escape closes, second
  Escape clears when the project convention does so; Home/End move the caret
  in the input, not the option, unless the pattern says otherwise; typing
  filters and keeps focus in the input.
- Announce result count changes in a polite live region
  ("12 products"), not on every keystroke if the list updates quickly;
  debounce the status text.
- Selected value must be readable in the input or trigger, with text, not
  only a highlight colour.

## Disclosure (accordion, "show more")

- Trigger: `<button aria-expanded="true|false" aria-controls="content-id">`.
  For an accordion the button sits inside a heading of the right level.
- Content: `hidden` when collapsed. Do not use `opacity` or off-screen
  positioning; collapsed content must leave the tab order.
- Keys: Enter or Space toggle. Accordions may add ArrowUp/ArrowDown and
  Home/End between headers; not required.
- Do not use `role="button"` on the heading itself; nest the button.

## Toast and status messages

- Container present in the DOM at page load (live regions added later are
  often not announced): `<div aria-live="polite" aria-atomic="true">` for
  status, `role="alert"` for errors that must interrupt.
- Inject the text, do not inject the container.
- A toast with an action ("Undo") must stay long enough to reach by keyboard
  or must not auto-dismiss; provide a focusable close button or an
  equivalent action elsewhere on the page.
- Do not move focus to a toast unless it blocks the flow.

## Tooltip

- Trigger element gets `aria-describedby="tooltip-id"`; tooltip
  `role="tooltip"`.
- Shows on focus and hover, hides on blur, mouse-out and Escape.
- Content is supplementary only. If it is the only name for an icon button,
  the button still needs its own `aria-label`.
- Hover content must be hoverable (the pointer can move onto it without it
  closing) and dismissible without moving the pointer.

## Form field with error

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email"
       required aria-invalid="true" aria-describedby="email-hint email-error">
<p id="email-hint">We only use this to send the receipt.</p>
<p id="email-error">Enter an email address with an @.</p>
```

On failed submit: focus the first invalid field, or an error summary
(`<div role="alert">` or a focused heading) that lists links to each field.
Error text must say what to do, not just "invalid".

## Data table

- `<table>` with `<caption>` or `aria-labelledby`; `<th scope="col">` and
  `<th scope="row">`.
- Sortable headers: a `<button>` inside the `<th>`, with `aria-sort` on the
  `<th>` set to `ascending`, `descending` or `none`.
- Row actions: real buttons with names that include the row ("Delete order
  1042"), not an icon with a shared tooltip.
- Grid keyboard navigation (`role="grid"`) only when cells are interactive
  and the project needs spreadsheet-like movement; otherwise a plain table.
