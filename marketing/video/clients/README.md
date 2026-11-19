# A film in a client's brand

**GamingClock** ("The clock", 0:47, 1920 × 1080) is the gaming-lounge film, and it is a template: every screen wears the brand in its `brand` prop. Make one JSON file per client and render it, so the client sees *their* lounge running on Ninja before they buy.

```
npx remotion render GamingClock out/clients/levelup.mp4 --props=clients/levelup.json
npx remotion render GamingClockAr out/clients/levelup-ar.mp4 --props=clients/levelup.json   # the same film in Arabic
```

Or open Studio (`npm run dev`), pick **The-clock / GamingClock**, and paste the JSON into the props panel to preview it.

| Field | What it is |
|---|---|
| `name` | The business name: on the end card ("Level Up, running on Ninja.") and as the logo when there is no image |
| `logoImage` | Optional. Their logo as a file in `public/`, e.g. `clients/levelup/logo.png` (transparent PNG or SVG, wide) |
| `logoFont` | Without an image, the name is set in one of: `bungee`, `anton`, `playfair`, `pacifico`, `inter` |
| `primary` | Their brand colour: the app's logo and buttons, and the glow behind the whole film |
| `slab` | A very dark shade of it: the room cards and the app's dock |
| `rooms` | Six rooms with their price per hour. The first is the one booked and played; the till shows all six |
| `snacks` | Three items with prices. `photo` is a name in `public/dishes` (`pizza`, `nachos`, `gshake`, `popcorn`, `hotdog`, `mocktail`…) or a path in `public/` to their own photo |
| `pitch` | `true` ends on their logo × the N and "<name>, running on Ninja."; `false` is the general ad ("Get Ninja for your lounge.") |

Their own photos go in `public/clients/<name>/`. Use square photos for the snacks.
