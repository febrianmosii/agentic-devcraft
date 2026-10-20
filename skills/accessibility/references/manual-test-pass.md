# Manual test pass (about ten minutes)

Run this on the feature you built or changed before reporting. Automated
scanners find a minority of defects, mainly missing names and contrast; the
steps below find the rest. Record what you did and what happened; the
report needs the facts, not a verdict.

## 1. Automated scan first (1 minute)

Run whatever the project already has. Typical commands:

- `npx eslint --ext .jsx,.tsx src/` with `eslint-plugin-jsx-a11y` enabled.
- An `axe` call in the component test (`expect(await axe(container)).toHaveNoViolations()`).
- `npx @axe-core/cli http://localhost:3000/page` or the axe DevTools
  browser extension.
- Lighthouse accessibility audit in Chrome devtools.

Write down the command and the violation count. Zero violations is a
necessary condition, not a result.

## 2. Keyboard only (4 minutes)

Do not touch the mouse or trackpad.

- Tab from the address bar into the page. Does focus land somewhere visible?
  Is there a skip link if the header is long?
- Tab through the whole feature. For each stop: can you see where focus is?
  Is the order the same as the visual order? Did anything get skipped
  (icon buttons, cards, table row actions)?
- Activate each control with Enter and, for buttons, Space. Did it do what
  a click does?
- Open every overlay (dialog, menu, dropdown, tooltip). Does focus move
  inside? Does Escape close it? Does focus come back to the opener?
- Inside composite widgets, use the arrow keys, Home and End. Do they move
  as the pattern expects? Does Tab leave the widget?
- Shift+Tab back through everything. Any trap (focus cannot leave an
  element or cycles in a widget forever)?
- Submit a form with errors. Where is focus now? Can you reach the first
  error and the error text from there?
- Trigger a dynamic update (filter, search, save). Did anything indicate it
  happened without looking at the screen? (See step 4.)

## 3. Zoom, width and colour (2 minutes)

- Set browser zoom to 200%. Any clipped text, overlapping controls or
  horizontal scrolling?
- Resize the viewport to 320px wide (devtools device toolbar). Same checks.
  Content may reflow and stack; it may not require scrolling in two
  directions.
- Devtools rendering panel: emulate `prefers-reduced-motion: reduce`. Does
  non-essential animation stop?
- Emulate a grayscale or achromatopsia vision deficiency. Can you still tell
  error from success, selected from unselected, link from text?
- Pick the new text and border colours with the devtools contrast checker.
  Note the ratios: 4.5:1 for normal text, 3:1 for large text, borders of
  controls and focus rings.

## 4. Screen reader (3 minutes, when the widget is custom or the flow is a form)

macOS: VoiceOver (Cmd+F5), navigate with VO (Ctrl+Option) + arrows, rotor
with VO+U. Windows: NVDA (free), navigate with arrows in browse mode, Tab in
focus mode, elements list with NVDA+F7. Any screen reader is enough to
catch the defects below; cross-browser parity is a separate concern.

- Read through the feature top to bottom. Does every control announce a
  role and a name ("Close dialog, button" rather than "button")?
- Open the headings list (rotor or NVDA+F7). Does the outline make sense
  and skip no levels?
- Open the landmarks list. Is there one `main`? Are navigation regions
  labelled when there is more than one?
- Enter each form field. Is the label read? Is the hint read? After a
  failed submit, is the error read as part of the field?
- Trigger a dynamic update. Is the new status announced once, politely?
  Is anything announced repeatedly or on every keystroke?
- Tab to images and icon buttons. Any "image", "graphic", "button" with no
  name, or a filename being read?
- Open a dialog. Is its title announced? Is content behind it still
  reachable with the virtual cursor? (It should not be.)

## 5. Record the result

Report fragment format:

```
Automated: `npx @axe-core/cli http://localhost:3000/products` -> 0 violations.
Keyboard: Tab order matches layout; filter dropdown opens with Enter and
ArrowDown, arrows move options, Enter selects, Escape closes and returns
focus to the trigger; result count announced via the existing status
region. Shift+Tab leaves the widget. No trap found.
Zoom/width: 200% and 320px OK; chip row wraps.
Contrast: option text #1F2937 on #FFFFFF 14.7:1; focus ring #2563EB on
#FFFFFF 5.2:1.
Screen reader: VoiceOver/Safari: "Category, combobox, collapsed" on the
trigger; options announce as "Shoes, 2 of 6". Not tested: NVDA, mobile.
```

Say what was not tested. Do not summarise the above as "accessible" or
"WCAG compliant"; summarise it as "no issues found in the checks listed".
