# The till's pop-ups

A pop-up says what it **holds**, and takes its width from that. A width is
never typed as a number: `showPosDialog` (and `DialogPanel`, for the few that
open through `showFDialog` themselves) is given a `DialogSize`. Both live in
`lib/core/widgets/pos_dialog.dart`. The sizes are the web till's
(`src/pos_web/docs/layout.md`).

| Size | Width | Use it for |
| --- | --- | --- |
| `DialogSize.sm` | 384 | A question and its answers: confirm, discard, a short notice, a PIN. |
| `DialogSize.md` (default) | 448 | A few fields or a short list: the usual pop-up. |
| `DialogSize.lg` | 512 | A list to pick from, a form in steps, a keypad beside its figures. |
| `DialogSize.xl` | 768 | Two columns side by side: a report, a count beside its keypad. |

```dart
showPosDialog<MoveTarget>(
  context,
  size: DialogSize.lg,
  builder: (_) => MoveTargetList(...),
);
```

There is no `maxWidth`: nothing on the till needs a width between these four.

## What every pop-up does

- **It never grows taller than the screen**: what does not fit scrolls inside
  it. The pop-up's body is a `DialogScroll` (24 of padding all round, and room
  to scroll a field clear of the keyboard), or a `SingleChildScrollView` where
  nothing is typed. A fixed head or foot stays outside it, with the list
  between them in a `Flexible`. A bare `Padding` + `Column` as the root can
  overflow a short screen: do not write one.
- **The keyboard slides over it** rather than pushing it: `showPosDialog`
  keeps the pop-up's place and height, and `DialogScroll` gains the slack to
  scroll what the keyboard covers into view. A tap on blank space puts the
  keyboard away before it closes anything.
- **On a phone it is a sheet from the bottom edge**, full width, whatever its
  size.
- **Its title is `type.title`**, one per pop-up (see `type.md`).

## Buttons side by side

- **A pop-up's answers are the same width**, the main one last: put them in
  `DialogActions`. On a tablet they sit at the pop-up's end, each as wide as
  the widest; `fill: true` spreads them over the pop-up's width instead. On a
  phone each takes the full width, the main one on top.
- **Options of one choice are the same width** (percent or amount, counter or
  delivery, cash or tab), whatever their words: each in an `Expanded`, or the
  pair in `EqualButtons` where they should take no more room than they need.
- **Their words are never cut**: equal means as wide as the widest needs, not
  an even share of too little room.
- **A figure is typed on the till's own keypad** (`NumericKeypad`), not into a
  field with the system's number keyboard.

## What is not a pop-up

- **Finding a customer** takes the whole screen (`CustomerSearchScreen`), so a
  tablet's keyboard never covers the box or its results. It is the one
  customer search on the till: a new sale, a round, a new bill, a room's
  people, a reservation and "find customer" all open it.
- **Taking payment** is a page of its own over the bill (`showSettle`, `settle_screen.dart`).

## What is still set by hand, and why

- **Remove and Retry on a send that failed** (`sending_chip.dart`,
  `sending_lines.dart`): two small actions at the end of a row beside its
  message, each its own width, so the message keeps the room.
- **Retry and Sign out on the no-branch screen**, and **previous / next page**
  in the shift history: a screen's own actions, not a pop-up's answers.
- **Lists inside a pop-up capped by hand** (`maxHeight` of 0.6–0.95 of the
  screen in the order's details, the place panel, closing a shift, a refund):
  they keep a fixed foot under a scrolling middle and predate `DialogScroll`.
  They stay inside the screen; new pop-ups should not copy them.
