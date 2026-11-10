# site_web

The platform's own site at the bare domain (ninjapp.net): the home page in
English (`/`) and Arabic (`/ar`), with the privacy policy, terms and support
pages beside it (`public/*.html`, plain HTML at the addresses the sign-in
screens link to).

The home page is one small café that runs in the visitor's browser. Every
screen on it (a guest's phone, the till, the kitchen screen, the rider's
phone, the owner's dashboard, the assistant) is drawn for the page to match
the real app, and all of them read one store, `src/cafe/store.ts`: an order
sent from the phone is the order the till takes, the kitchen makes and the
dashboard counts. `src/cafe/runner.ts` keeps the café going by itself until a
visitor touches a screen.

```
npm run dev      the page at http://localhost:5173, Arabic at /ar
npm run test     the café's rules, the plans table against Plans.cs, both languages' shape
npm run build    type-check, bundle, then render / and /ar to HTML in dist
npm run photos   remake public/dishes from marketing/video/public (kept in git; rarely needed)
```

- **Words**: `src/content/en.ts` and `ar.ts`, the same shape. Say only what is
  built and switched on; the plans table is `src/cafe/plans.ts`, checked
  against `src/Control.API/Platform/Plans.cs`.
- **Contact**: `src/content/contact.ts`. The WhatsApp button shows once the
  number is filled in; until then the page offers email.
- **Copied from client_web**, each file saying so at its top: the motion
  numbers, the rolling counter and the photo flight (`src/lib`).
- **Shipping**: `deploy-platform.yml` builds it with the web apps and syncs
  `dist` into the server's `site/`, which Caddy serves at the bare domain.
