# Ninja explainer video

A 45-second marketing video made from **real recordings of the apps**, on a plain page in the Ninja style. Recording, composing and rendering are all scripted, so a new cut after a UI change is three commands.

```
capture/        records the real apps (Playwright, against the local Aspire stack)
  rec.mjs         shared helpers: slow-motion clock, full-density capture, touch dot / cursor, VP9 encode
  order.mjs       phone at Table 3 → till confirms → kitchen marks it ready (three clips)
  scenes.mjs      admin "Scan a menu", the Book tab, the menu scrolling in the other language
  look*.mjs, explore*.mjs, *test*.mjs   one-off probes used while building (safe to delete)
clips/          the recordings (*.webm) and their timings (*.json)
assets/         paper-menu.html/.jpg, the "printed menu" photo the admin scan reads
index.html      the composition: captions, device frames, one GSAP timeline (open it to preview)
render.mjs      index.html → MP4 (frame by frame, with music.mp3)
music.mp3       background track (Artlist, Lyria 3 Pro, instrumental)
v1-mockup.*     the first, drawn version (not used)
```

## Re-record and render

1. Start the stack: `dotnet run --project src/Ninja.AppHost/Ninja.AppHost.csproj` (Docker running). Wait for ports 5173–5176.
2. Sign-in states (once; they expire): the capture scripts read `capture/pos-state.json`, `kds-state.json` and `admin-state.json`. Recreate them with `node capture/explore5.mjs` (kitchen), `node capture/explore6.mjs` (till) and `node capture/explore8.mjs` (admin); dev users come from `src/Ninja.AppHost/KeycloakConfiguration/realms/chillax-realm.json` (`cashier`, and `admin@chillax.site`).
3. Record, from `marketing/explainer`:
   ```
   node capture/order.mjs en          # phone-order-en, pos-confirm-en, kds-en
   node capture/scenes.mjs en         # admin-scan-en, phone-book-en, phone-menu-ar
   node capture/scenes.mjs ar arabic  # phone-menu-en
   ```
   For the Arabic cut, run the same with `ar` (the phone records in Arabic; the till, kitchen and admin record in whatever language those apps are set to).
4. Preview: open `index.html` (or `index.html?lang=ar`) and press Play.
5. Render: `node render.mjs --lang en` → `ninja-explainer-en.mp4` (`--lang ar` for Arabic). `node render.mjs --stills 8,17,23` writes check frames to `stills/`.

## How the recording works

Screenshots at 2× only come at ~12 fps, so each page's clock runs at ⅛ speed while it is recorded (timers, `requestAnimationFrame`, `performance.now`, `Date`, and CSS/Web Animations through CDP). The frames are then laid back on the page's own timeline at 30 fps, which gives smooth 2× footage of the real motion. Network stays real time, so slow calls (the AI scan) shrink by 8× in the clip.

Each recording creates real orders in the local database (tables 1, 3 and 4 of El-Manshia), confirms them on the till and marks them ready in the kitchen.

## Timeline (index.html)

| Time | Scene | Clip |
|---|---|---|
| 0–3 | Intro: mark, wordmark, "Everything your café runs on." | — |
| 3–14.5 | 1 · At the table | phone-order (the form part at 1.6×) |
| 14.9–19.3 | 2 · At the counter | pos-confirm |
| 19.7–25.6 | 3 · In the kitchen | kds |
| 26–30.6 | 4 · Rooms and tables | phone-book |
| 31–37.2 | 5 · The back office | admin-scan (leans in on the proposal) |
| 37.6–41.4 | English and Arabic | phone-menu-en, phone-menu-ar |
| 41.8–45 | End: ninjapp.net | — |

Captions live in `index.html` (English in the markup, Arabic in the `AR` table).

## Next cut (v2), agreed 2026-09-29

- **Look:** Chillax's real logo (`src/client_app/assets/images/logo.png`) on its app, the **Tiles** menu style (photos), the **black dock**; better typography in the captions; camera zooms to focus on each feature, still minimal.
- **Story, 60 s, easy for guests and for the café:** your brand (logo and colours set on the admin Brand page, the phone preview changes live) → order from the table (Tiles) → book a room (its reservation effect) → ask for a new controller from the room → pay the bill (pay fully / split) → loyalty points → the till confirms → the kitchen → AI menu scan → AI recipes (Menu → Track items → Propose recipes) → stock from a supplier's receipt photo (Stock → Receive → Scan receipt, `assets/supplier-receipt.jpg`) → menu cost. No English/Arabic scene.
- `capture/cafe.mjs` records the recipes and receipt scenes (`node capture/cafe.mjs recipes,receive`).

## Known local issues

- **Identity behind the gateway answers 502** when Windows has reserved its HTTPS port (7260 inside `netsh int ipv4 show excludedportrange protocol=tcp`). Booking, joining a room (the controller request) and the profile's phone number all need it. Fix: `net stop winnat; net start winnat` in an admin terminal, then restart `identity-api` from the Aspire dashboard.
- **Gemini free tier** allows about 10 requests a minute and sometimes answers 503; the AI scenes (menu scan, recipes, receipt) may need a retry a minute later.
- Under the slowed clock the "Track N items" save click in `cafe.mjs recipes` did not save once; check Inventory → Menu cost afterwards, or save at normal speed first.
