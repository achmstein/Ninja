# site_web

The platform's own site at the bare domain (ninjapp.net): the home page in
English (`/`) and Arabic (`/ar`), with the privacy policy, terms and support
pages beside it (`public/*.html`, plain HTML at the addresses the sign-in
screens link to).

The home page shows the real apps, not drawings of them. Each app on it is
the app as it ships, built into `/demo/<app>/` and running in the visitor's
browser against a stand-in for a café's server: a service worker
(`demo/sw.js`) that answers the API with one made-up café, Mellow. Nothing
behind it runs and nothing reaches a real business. A visitor cannot operate
the apps; a script taps their own controls (`src/live/driver.ts`), so what
moves is the app's own motion. The page around them is plain: white, one
grey, a few words.

```
npm run demo     build the real apps into public/demo (needed once before dev, and after an app changes)
npm run dev      the page at http://localhost:5173, Arabic at /ar
npm run test     the plans table against Plans.cs, and both languages' shape
npm run build    the demo apps, type-check, bundle, then / and /ar rendered to HTML in dist
```

- **Words**: `src/content/en.ts` and `ar.ts`, the same shape. Keep them few,
  and say only what is built and switched on. The plans table is
  `src/plans/plans.ts`, checked against `src/Control.API/Platform/Plans.cs`.
- **A live app**: `<LiveApp>` (`src/live/live-app.tsx`) frames one at its
  device's own size and scales it; its script is a list of steps (tap the
  control named so, scroll, wait, start over).
- **The demo's data**: `demo/sw.js`. A new screen usually means a new answer
  there; `marketing/site-capture/shot.mjs` takes a look at the page.
- **Contact**: `src/content/contact.ts` (WhatsApp number and email).
- **Shipping**: `deploy-platform.yml` builds it after the web apps (the demo
  build uses their installed packages) and syncs `dist` into the server's
  `site/`, where Caddy serves `/demo/<app>/` as an app of its own.
