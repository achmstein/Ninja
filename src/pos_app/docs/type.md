# The till's type

One rule: a piece of text says what it **is**, and takes its size, weight and
line height from that. Sizes and weights are not picked by hand on a screen.

The roles are getters in `lib/core/theme/type_roles.dart`, the same seven as
the web till's `type-*` utilities (`src/pos_web/docs/type.md`). They are read
from the theme or straight from the context:

```dart
import '../../../core/theme/type_roles.dart';

final theme = context.theme;
Text(customer.name, style: theme.type.heading)
Text(phone, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground))
Text(money(context, total), style: context.type.figure)
```

| Role | Getter | Size / line / weight | Use it for |
| --- | --- | --- | --- |
| Title | `type.title` | 20 / 28 bold | The name of a screen, a panel or a dialog. One per surface. |
| Heading | `type.heading` | 16 / 24 semibold | A part's heading inside a surface; the name that leads a row (a customer, a bill). |
| Body | `type.body` | 16 / 24 regular | What is read and typed: rows, fields, sentences. |
| Detail | `type.detail` | 14 / 20 regular | A row's second line, a dense list (the order's lines), what stands beside the main thing. |
| Caption | `type.caption` | 12 / 20 regular | A hint, a count, a time. Nothing on the till is smaller. |
| Label | `type.label` | 12 / 20 semibold, capitals, letter-spaced | A quiet name over a group ("New", "Sent", "Recent"). |
| Figure | `type.figure` | 24 / 32 bold, tabular | The one figure a surface is about: the total, the clock. |

## What goes with a role

- **Colour is separate.** A role starts from the theme's own text style (the
  foreground colour, the language's font) and never chooses a colour.
  Secondary text adds `.copyWith(color: theme.colors.mutedForeground)`.
- **Emphasis inside a role** is one step of weight, no more: `FontWeight.w500`
  on Detail for an item's name, `w600` on Detail or Body for the one that
  matters in a row. Never bold, never a different size.
- **A label is shown with `TypeLabel(text)`**: the label role, muted, its words
  in capitals. Capitals are for Latin text only: Arabic has none and comes
  back as written, and its letters are not spaced apart (spacing breaks the
  joins). Where a `Text` is needed instead, pass the words through
  `labelCase(text)` and style them `type.label`.
- **Numbers that line up** (money, counts, clocks, phone numbers) add
  `fontFeatures: const [FontFeature.tabularFigures()]`; Figure has them
  already. A phone number or an amount also keeps `textDirection: TextDirection.ltr`.
- **A long name is cut, never wrapped into the price:** `maxLines: 1` with
  `TextOverflow.ellipsis`, `maxLines: 2` where two are allowed (menu tiles,
  bill cards, area names).
- **Arabic and English share every role.** The font changes with the language
  (`Alexandria` for Arabic, `Inter` otherwise); the sizes do not.

## Buttons

A control's text goes with its height, not with a role. Three getters, none
with a colour (the button decides it: white on primary, foreground on
outline), so they take the place of `….forButton`:

| Getter | Size | For |
| --- | --- | --- |
| `type.button` | 16 | An ordinary button, 44–48 high (`Sizes.control`). The button gives the weight (medium). |
| `type.buttonSmall` | 14 | A small button or a chip, 40 high (`Sizes.controlSmall`). |
| `type.mainAction` | 18 semibold | The screen's one main action, 56 high (`Sizes.controlLarge`): Charge, Send, Settle. |

## Not to do

- No `fontSize:` typed as a number, and no `theme.typography.sm / base / lg /
  xl…` on a screen: pick the role that says what the text is.
- No `theme.typography.title / heading / label / body / caption / figure`:
  those are ninja_app_core's older six-step scale (`TypeRoles`), which the
  kitchen display and the rider app are drawn with. Their sizes differ (its
  title is 18, its heading 20, its label 14, its figure 30). The till's roles
  are under `type`, never under `typography`.
- No weight chosen to "make it stand out", and no text under 12.
- No line height tighter than the role's on text that is cut short
  (`maxLines` with an ellipsis): Arabic letters reach higher and lower than
  Latin ones and a tighter line clips them. Do not pass `height:` to a role.
- No text in a box sized tighter than its lines: two lines of Detail need 40,
  two of Body or Heading 48.

## Where it is applied

Every screen and pop-up of the tablet till. What is still set by hand, each
for a reason:

- **Buttons** (`type.button`, `type.buttonSmall`, `type.mainAction`): their
  size goes with their height, as above.
- **Text fields**: Forui's own field text (14), sized with the field's height
  in ninja_app_core's theme, which the other apps share.
- **The keypads' keys** (`NumericKeypad`, the PIN pad): 20, with the key's
  height.
- **An amount being typed** (the settle keypad's box, paying a tab, opening
  and closing a shift, a cash movement): 30 bold, `theme.typography.xl3`. A
  large number under the cashier's finger, not a figure being read.
- **The closed shift's three figures** (expected, counted, over or short):
  Title's size with tabular figures. Three side by side do not fit at
  Figure's 24 on a phone.
- **The letters a search matched** in a customer's name: bold on a tinted
  ground, inside a Heading.
- **Printed paper** (`features/receipt`: the receipt, the tab payment slip,
  and the receipt preview that shows the sheet; `shift_report_sheet.dart`):
  paper has its own sizes.
- **The brand mark, the splash and the connect screen**: drawn before a
  business's theme exists, in the brand's own type.
- **Forui's own widgets** (a badge's words, a switch's label): their defaults.
