# Theming: how a café's brand becomes the customer app's look

The customer surfaces (client_web, client_app, printed paper) wear the
café's brand. Staff surfaces (admin, till, kitchen, control) are Ninja and
stay neutral. This is the pattern every surface follows, and why.

## The pattern

1. **Components read semantic tokens, never colours.** A button reads
   `primary` and `primary-foreground`, a page reads `background` and
   `foreground`, a chip reads `secondary`. shadcn's components already do
   this through CSS variables; Forui's do it through `FColors`. No
   component knows a hex value.
2. **Light and dark are two mappings of the same tokens.** Every token has a
   value in each scheme. A component never asks which scheme is on.
3. **A brand supplies seeds, not values.** The seeds are: `primaryColor`,
   and in `theme`: `accent`, `surface`, `radius`, `headerSize`, `fontLatin`,
   `fontArabic`, and an optional `dark` with its own `primary`, `accent`,
   `surface`. Everything else is derived.
   - `radius` (`none`…`xl`) sets `--radius`, and with it every corner:
     cards and inputs through shadcn's `--radius-sm…xl`, sheets through
     `--radius-2xl/3xl`, and chips and pill buttons through `--radius-pill`
     (`rounded-pill`): square for `none`, small for `sm`, a full pill from
     `md` up. Circles (dots, avatars, icon buttons) are not corners and stay
     `rounded-full`.
   - `headerSize` (`sm` the default, `md`, `lg`) sets `--header-h` and
     `--wordmark-h`: the customer app's header and the wordmark in it, for a
     wide logo that needs more room than a thin one. The Flutter app shows
     its wordmark hero-sized (login, profile) and only carries the seed.
4. **Derivation is one function, ported once.** `brandTokens()` in
   `src/*_web/src/lib/brand-theme.ts` (identical in every web app) and
   `brandedColors()` in `src/client_app/lib/core/brand/brand_theme.dart` run
   the same maths in OKLCH:
   - the light `primary` is the seed, kept off the extremes; the dark one is
     lifted and calmed unless `dark.primary` is given;
   - the `accent` seed becomes `secondary` (chips, badges, secondary
     buttons) and a pale `accent` for hovers; pulled down to a deep tint on
     dark unless `dark.accent` is given;
   - the `surface` seed is the light page as given; its hue tints every
     neutral (text, muted, border) in both schemes, and the dark page is
     that hue near black unless `dark.surface` is given;
   - the text on any fill is white or near-black, whichever contrasts more.
     Text colours are never stored.
5. **Fonts follow the script.** `fontLatin` and `fontArabic` are two
   families from allowlists the apps can load; the page reads
   `var(--font-latin)` and `var(--font-arabic)`, Arabic first under `dir=rtl`.
   Type sizes and weights belong to the product, not the brand.
6. **Contrast is checked, not hoped for.** `contrastIssues()` reports every
   text-on-fill pair below WCAG AA (4.5:1) in either scheme; the brand forms
   show them before a save. A seed that fails is still saved, since the
   owner decides, but never silently.
7. **Tokens are data, applied before first paint.** The theme is JSON on
   `GET /api/tenant` (Tenant.API `TenantTheme`, jsonb), cached in the
   browser and on the device, and injected as one `<style>` after
   `styles/theme.css`, so the neutral file is never edited and the tenant's
   values win in both `:root` and `.dark`. The `theme-color` meta follows the
   page of the active scheme.
8. **Every preview is the same function.** The phone mock in the control
   panel and the admin reads `brandTokens()`; the live frame is the real app.
   What the form shows is what customers get.

## Where it lives

| Piece | Path |
|---|---|
| Seeds and allowlists | `src/Tenant.API/Model/Tenant.cs` (`TenantTheme`, `TenantThemeDark`), validated in `Apis/TenantApi.cs` `NormalizeTheme` |
| Token generator (web) | `src/{control,admin,client,pos,kds}_web/src/lib/brand-theme.ts`, one file copied, tested in `admin_web/src/lib/brand-theme.test.ts` |
| Token generator (Flutter) | `src/client_app/lib/core/brand/brand_theme.dart`, tested in `test/widget_test.dart` |
| Neutral theme | `src/client_web/src/styles/theme.css` (`--font-latin`, `--font-arabic`, the shadcn variables), Forui's zinc in the app |
| Forms | control_web Brand tab (`features/tenants/tabs/brand.tsx`), admin_web Brand page (`features/brand/index.tsx`): seeds, a collapsed dark section, the contrast notice |
| Previews | `components/brand/phone-preview.tsx` (mock), `live-preview.tsx` (the app) in both apps |

## Adding a token or a seed

Add the seed to `TenantTheme` and its DTO, the validation, the two
generators and their tests, then the two forms. Never add a stored text
colour or a per-scheme copy of a seed outside `dark`: derive it.

## Beyond one theme

The seeds are a value object, so more than one theme is a matter of
storing more than one: platform presets (named seed sets an owner picks
from), a seasonal theme with a date window, or a high-contrast variant
derived from the same seeds. Per-branch themes are not planned: the brand
is the café's.
