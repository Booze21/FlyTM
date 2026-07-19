# TMbilet — SEO Audit & Delivery Report (real files, not placeholders)

**Date:** 2026-07-19 · Built from `TMbilet.zip` (the real site export)

This supersedes the earlier report, which was written from a partial
GitHub view. Everything below is grounded in your actual `index.html`,
`app.js`, `i18n.js`, `airports.js`.

## 1. What the site actually is

`app.js`'s `buildSearchUrl()` redirects every search to `avia.tmbilet.com`
with `origin_iata`/`destination_iata`/dates as query params, tagged
`// build Travelpayouts deeplink`. TMbilet is a **Travelpayouts affiliate
front end** — a lead-gen page that hands the visitor to Travelpayouts'
booking engine. Completely legitimate business model; it just changes
what "SEO landing page" needs to mean here: the page's job is to get a
qualified visitor to click through with the right route pre-filled, not
to show its own results.

## 2. Security — good news, one loose end

The `tp-em.com` malicious-script injection I flagged from the GitHub copy
is **not present in these real files**. Whatever's actually live either
never had it or it's already been removed. One thing worth doing:
confirm the version on GitHub (and whatever's actually deployed at
tmbilet.com right now) matches this clean copy — if GitHub still has the
old `<head>`, push this one over it.

## 3. `test.txt` — what it is

A 626KB HTML file that turned out to be a **Travelpayouts widget
integration sample** (`tpwl-widget-weedles`, `TPWL_EXTRA` config object,
cookie banner) — the kind of reference snippet Travelpayouts hands out
in their docs for embedding a "popular destinations" price widget. The
script URL still has an unresolved `[:widget_domain:]` placeholder, so
it was never live. Two honest options: delete it (it's dead weight — a
626KB stray file hurts nothing SEO-wise sitting unlinked, but it's
repo clutter and a 626KB accidental page really shouldn't exist on a
production host), or finish wiring it up properly if you actually want
that widget on the homepage.

## 4. Real gaps found in `index.html`/`app.js`

- **No canonical, hreflang, OG/Twitter, robots meta.** Fixed below.
- **hreflang scope mismatch:** `i18n.js` already has full translations
  for **7 languages** (en/tr/ru/ar/de/es/fr), not just the 3 in the
  brief. Built EN/TR/RU for real below since that's what was asked for;
  extending to the other 4 is the same script, one line (`LANGS` list).
- **"Popular destinations" grid is 100% JS-injected** — `<!-- cards
  injected by JS -->`, nothing server-rendered. Anything that doesn't
  execute JS (and some crawlers/preview bots don't) sees an empty grid.
  Not fixed in this pass — flagging as the next indexability item.
- **Relative asset paths** (`src="app.js"`, `href="tmbilet-logo.png"`,
  no leading `/`) — harmless at `tmbilet.com/` but a 404 the instant the
  same markup is served from a subdirectory like `/tr/`. **Fixed**
  everywhere in the generated output.
- **Redundant favicon link:** `<link rel="icon" href="tmbilet-logo.png">`
  points at the full logo file alongside the proper `favicon.ico`/
  `favicon-32x32.png`/`android-chrome-*` set that already exists — minor,
  left as-is, safe to delete manually if you want one less request.
- **SearchAction schema — corrected, not implemented:** my earlier draft
  planned a WebSite+SearchAction block for Google's sitelinks search box.
  That schema is documented by Google for a single free-text query box,
  not a multi-field flight form (origin+destination+dates) — using it
  here would be structurally invalid, not just unnecessary. Dropped it
  rather than ship non-compliant markup.
- **No `site.webmanifest`**, despite `android-chrome-192x192.png` /
  `-512x512.png` already existing in the export — created it.

## 5. What's built and verified working

All in the delivered `site/` folder — this is a drop-in replacement for
your site root, not a template to hand-copy.

**`/` and `/tr/`, `/ru/`** — real static HTML per language, built by
`scripts/localize_build.py` from the *actual* `i18n.js` dictionary (not
invented copy): server-rendered translated text, unique `<title>`/
description per language, full reciprocal hreflang, OG/Twitter, and
Organization + BreadcrumbList + FAQPage JSON-LD (FAQ content mirrors your
real "Why book with TMbilet" section, translated). CSS pulled out of the
inline `<style>` block into `/assets/site.css`, shared and cached across
all pages — HTML payload dropped from 65KB to ~29KB per page.

**`/flights/istanbul-to-ashgabat/` and `/flights/ashgabat-to-istanbul/`**
— built by `scripts/generate_routes.py`. Each page embeds your *actual*
`<form id="searchForm">` (header, footer, date picker, and all — not a
mockup), pre-filled for the route using the exact same
`input.value` / `input.dataset.code` pattern `app.js`'s own destination-
card click handler uses, so it's consistent with how the app already
works. Route facts (duration, airlines, aircraft, distance) are sourced
and cross-checked (Skyscanner, FlightConnections, FlightsFrom.com,
Turkish Airlines' own route page, June–July 2026) — Turkish Airlines and
Turkmenistan Airlines fly this nonstop on the Boeing 787, ~4 hours,
~2,560km. Re-verify periodically; schedules change.

**`sitemap.xml`, `robots.txt`, `site.webmanifest`** — finished, matching
the real URL set above.

## 6. Doorway-page reminder

Still only 2 routes. `airports.js` has enough airports that every
combination would run into the thousands — auto-generating that many
near-duplicate pages is a real Google spam-policy risk, not a style
nitpick. Add routes to `generate_routes.py`'s `ROUTES`/`ROUTE_FACTS`
one at a time, each with real, checked facts.

## 7. Not done yet — needs a decision, not just effort

- **Server-render the destinations grid** so it's not JS-only.
- **TR/RU versions of the route pages** (currently EN-only).
- **Extend hreflang to ar/de/es/fr** given the translations already exist
  — worth doing since the work's already there, but confirm you want it.
- **CSP / security headers** — depends on actual hosting (GitHub Pages
  can't set custom headers directly; if you're elsewhere, tell me and
  I'll draft one).
- **Delete or finish `test.txt`'s widget** — your call, see §3.

## 8. How to deploy

Copy everything in `site/` over your current site root, keeping the
folder structure (`/tr/`, `/ru/`, `/flights/...`, `/assets/site.css` all
matter — don't flatten it). `scripts/` are build tools, not site files —
keep them in the repo but they don't get deployed.
