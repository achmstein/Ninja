# Brand styles: one UX, many looks

Status: planned 2026-09-25, not started. Implement in a fresh session.

## Goal

Every café keeps the same customer flow (menu → item → cart → checkout →
orders → bills), but can look distinctly its own. Today two cafés differ
only in colours, fonts, corner radius and header size, so they look alike.
Add **styles**: curated presets that change how the customer apps are
dressed (component variants + tokens), chosen per brand, previewed live,
with per-part overrides.

Out of scope: staff apps (admin, till, KDS) keep colours and fonts only;
no per-café custom CSS/HTML; no flow changes.

## What exists (read these first)

| Piece | Where |
|---|---|
| Theme model (tokens, validation lists `Radii`, `HeaderSizes`, `LatinFonts`, `ArabicFonts`) | `src/Tenant.API/Model/Tenant.cs` → `TenantTheme` (~line 169), DTO `TenantThemeDto` in `src/Tenant.API/Apis/TenantApi.cs` |
| Control plane brand API/types | `src/Control.API/Apis/ControlApi.Brand.cs` → `BrandTheme`, `BrandThemeDark`; `PUT /tenants/{slug}/brand` |
| Brand tab + live phone preview | `src/control_web/src/features/tenants/tabs/brand.tsx`, `src/control_web/src/components/brand/{live-preview,phone-preview,phone-frame}.tsx`, `src/control_web/src/lib/brand-theme.ts` |
| Owner's brand page | `src/admin_web/src/features/brand/index.tsx` |
| Customer web: theme applier | `src/client_web/src/lib/brand-theme.ts`, `src/client_web/src/lib/brand.ts` |
| Customer web: the surfaces to vary | `src/client_web/src/components/app-header.tsx`, `components/menu/{item-card,category-rail,offers-carousel,view-cart-bar}.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx` |
| Customer Flutter app theme | `src/client_app/lib/core/brand/{brand_theme,tenant_brand}.dart` |

## Design

### Model
Extend `TenantTheme` (and every DTO/copy of it) with:

```
Style: string?          // preset key: "classic" | "minimal" | "bold" | "cozy" | "night"; null = classic (today's look)
Layout: TenantLayout?   // per-part overrides; null part = the style's choice
  MenuItem:   "card" | "row" | "compact" | "hero"
  Categories: "chips" | "tabs" | "rail"       // rail = side list on wide screens, chips on phones
  Header:     "left" | "center" | "banner"    // banner uses a new cover image slot
  Buttons:    "pill" | "rounded" | "square"
  Surface:    "flat" | "outlined" | "shadow"
  Density:    "airy" | "comfortable" | "compact"
```

Validate against fixed lists like `Radii` does. A **cover image** slot
(`cover.jpg`, e.g. 1600×600) joins the existing brand image slots for the
banner header (same upload pipeline as logos: `TenantBrandStore`, image slots
in control_web).

### Presets (single source of truth)
A small shared table, one per platform, identical content:
- `src/client_web/src/lib/styles.ts` and `src/client_app/lib/core/brand/styles.dart`
- Each preset = layout choices + token defaults (radius, font pair, shadow,
  border weight, spacing scale, heading weight/case). The café's own
  colours/fonts/radius **override** the preset's defaults when set.

| Preset | MenuItem | Categories | Header | Buttons | Surface | Density | Type |
|---|---|---|---|---|---|---|---|
| classic (default, today) | card | chips | left | rounded | outlined | comfortable | brand fonts |
| minimal | compact | tabs | center | square | flat | airy | light weights, no photos |
| bold | hero | chips | banner | pill | shadow | comfortable | heavy headings |
| cozy | row | chips | banner | rounded | shadow | comfortable | serif headings (Playfair Display) |
| night | card | tabs | center | pill | outlined | comfortable | forces dark mode tokens |

### Rendering
- **client_web**: resolve `effective = { ...preset(style), ...layoutOverrides }`
  once in `brand.ts`; expose via a `useBrandLayout()` hook; set
  `data-surface`, `data-density`, `data-buttons` attributes on `<html>` so
  most variants are pure CSS (Tailwind v4 custom variants, e.g.
  `@custom-variant surface-flat ([data-surface=flat] &)`); only
  `item-card.tsx` (4 variants), `category-rail.tsx` (3) and `app-header.tsx`
  (3) branch in React. Keep one component per concern with a `variant` prop,
  not parallel copies.
- **client_app**: same resolution in `tenant_brand.dart`; variants as widget
  parameters (`MenuItemTile(variant: ...)`), theme extensions for
  surface/density.
- RTL and dark mode must work for every variant.

### Editing
- control_web Brand tab and admin_web Brand page: a **Style** picker (5
  visual cards showing a mini preview), then an "Adjust" disclosure with the
  six per-part selects (each with "Style default"). The existing live phone
  preview renders the real variants (it already iframes/embeds the customer
  surface — confirm how and reuse).
- Changing style never touches colours/fonts the owner set.

## Steps
1. Tenant.API: model + DTO + validation + migration (JSON column like the
   existing theme, if it's stored as JSON — check) + cover image slot; unit tests.
2. Control.API: pass-through types, brand read/write, seed default; tests.
3. client_web: presets table, resolver + hook + data attributes, variants for
   item card / categories / header / buttons / surfaces / density; vitest for
   the resolver; screenshots (390×844, 1280×800, en/ar, light/dark) per preset.
4. control_web + admin_web: style picker + overrides + preview; regenerate
   API clients.
5. client_app: presets + variants + theme extensions; widget tests; golden
   screenshots per preset.
6. Show the user screenshots of all five presets before release.

## Acceptance
- Five presets visibly distinct on the menu screen; every flow identical.
- Per-part override works and survives a style change.
- No horizontal scroll at 360px; RTL correct; dark mode correct.
- Staff apps unchanged.
- Old cafés (no `Style`) look exactly as today (classic).
