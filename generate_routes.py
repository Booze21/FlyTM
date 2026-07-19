#!/usr/bin/env python3
"""
generate_routes.py

Builds real static /flights/<slug>/index.html pages that embed the
site's actual, working search form (not a mockup) — extracted directly
from index.html — pre-filled for the route, plus real BreadcrumbList +
FAQPage schema and route facts.

Route facts below are sourced (Skyscanner, FlightConnections,
FlightsFrom.com, Turkish Airlines' own route page — cross-checked
across sources, June–July 2026) rather than invented, because wrong
duration/airline claims on a real booking site mislead customers, not
just search engines. Re-verify periodically — schedules change.

Currently ships the 2 example routes from the brief. Adding a new one
is: add real, checked facts to ROUTE_FACTS, add the pair to ROUTES.
Deliberately NOT looping over every airports.js combination — see the
doorway-page warning in the main report.
"""

import json
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

SITE = "https://tmbilet.com"
SRC_HTML = Path("index.html")
OUT_DIR = Path("build/flights")

ROUTES = [("IST", "ASB"), ("ASB", "IST")]

AIRPORTS = {
    "IST": {"city": "Istanbul", "country": "Turkey"},
    "ASB": {"city": "Ashgabat", "country": "Turkmenistan"},
}

# Sourced facts, keyed by (from, to). Kept separate from AIRPORTS since
# these are route-specific, not airport-specific.
ROUTE_FACTS = {
    ("IST", "ASB"): {
        "duration": "about 3 hours 45 minutes to 4 hours, nonstop",
        "airlines": "Turkish Airlines and Turkmenistan Airlines",
        "aircraft": "Boeing 787 Dreamliner",
        "distance": "around 2,560 km (1,590 mi)",
        "frequency": "multiple nonstop departures most days of the week",
        "tz_note": "Ashgabat is 2 hours ahead of Istanbul (UTC+5 vs UTC+3).",
    },
    ("ASB", "IST"): {
        "duration": "about 4 hours to 4 hours 20 minutes, nonstop",
        "airlines": "Turkish Airlines and Turkmenistan Airlines",
        "aircraft": "Boeing 787 Dreamliner",
        "distance": "around 2,560 km (1,590 mi)",
        "frequency": "multiple nonstop departures most days of the week",
        "tz_note": "Istanbul is 2 hours behind Ashgabat (UTC+3 vs UTC+5).",
    },
}

FAQ_TEMPLATES = [
    ("How long is the flight from {from_city} to {to_city}?",
     "The nonstop flight from {from_city} to {to_city} takes {duration}."),
    ("Which airlines fly from {from_city} to {to_city}?",
     "{airlines} operate nonstop flights on this route, typically using the {aircraft}."),
    ("How far is it from {from_city} to {to_city}?",
     "{from_city} and {to_city} are {distance} apart by air."),
    ("Do I need a visa to travel to {to_country}?",
     "Visa requirements depend on your nationality — check the latest requirements with the {to_country} embassy or your travel agent before booking."),
]


def slugify(city):
    return city.lower().replace(" ", "-")


def fix_relative_asset_paths(soup):
    def is_relative(url):
        return url and not url.startswith(("/", "http://", "https://", "data:", "#"))
    for el in soup.select("script[src], img[src]"):
        if is_relative(el.get("src")):
            el["src"] = "/" + el["src"]
    for el in soup.select("link[href]"):
        if is_relative(el.get("href")):
            el["href"] = "/" + el["href"]


def build_page(template, from_code, to_code):
    from_a, to_a = AIRPORTS[from_code], AIRPORTS[to_code]
    facts = ROUTE_FACTS[(from_code, to_code)]
    slug = f"{slugify(from_a['city'])}-to-{slugify(to_a['city'])}"
    canonical = f"{SITE}/flights/{slug}"

    soup = BeautifulSoup(str(template), "html.parser")
    fix_relative_asset_paths(soup)  # mutate in place before extracting pieces below

    header = soup.find("header")
    footer = soup.find("footer")
    search_form = soup.find("form", id="searchForm")
    config_script = soup.find("script", attrs={"data-cfasync": "false", "type": None})
    # scripts with an src, in original order (i18n, airports, airports-search, app)
    src_scripts = [s for s in soup.find_all("script") if s.get("src")]
    # the inline date-picker script — the only remaining inline <script>
    # (no src, no type=ld+json) that isn't the small TMBILET_CONFIG one
    inline_scripts = [
        s for s in soup.find_all("script")
        if not s.get("src") and s.get("type") != "application/ld+json"
    ]
    date_picker_script = max(inline_scripts, key=lambda s: len(str(s)))

    title = f"Cheap Flights from {from_a['city']} to {to_a['city']} ({from_code} \u2192 {to_code}) | TMbilet"
    description = (
        f"Compare {from_a['city']} to {to_a['city']} flights. "
        f"{facts['airlines']} fly nonstop in {facts['duration']}. "
        f"Search fares and book on TMbilet."
    )

    faq_items = []
    for q_tmpl, a_tmpl in FAQ_TEMPLATES:
        ctx = {
            "from_city": from_a["city"], "to_city": to_a["city"],
            "to_country": to_a["country"], **facts,
        }
        faq_items.append({
            "@type": "Question",
            "name": q_tmpl.format(**ctx),
            "acceptedAnswer": {"@type": "Answer", "text": a_tmpl.format(**ctx)},
        })

    breadcrumb = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "Flights", "item": f"{SITE}/flights/"},
            {"@type": "ListItem", "position": 3, "name": f"{from_a['city']} to {to_a['city']}", "item": canonical},
        ],
    }
    faq_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    page = BeautifulSoup("<!DOCTYPE html><html lang=\"en\"><head></head><body></body></html>", "html.parser")
    head, body = page.head, page.body

    def add(tag, **attrs):
        t = page.new_tag(tag, attrs=attrs)
        head.append(t)
        return t

    m = page.new_tag("meta", attrs={"charset": "UTF-8"})
    head.append(m)
    add("meta", name="viewport", content="width=device-width, initial-scale=1.0")
    t = page.new_tag("title"); t.string = title; head.append(t)
    add("meta", name="description", content=description)
    add("meta", name="robots", content="index, follow")
    add("link", rel="canonical", href=canonical)
    add("link", rel="icon", href="/favicon.ico", sizes="any")
    add("link", rel="icon", type="image/png", sizes="32x32", href="/favicon-32x32.png")
    add("link", rel="icon", type="image/png", sizes="192x192", href="/android-chrome-192x192.png")
    add("link", rel="apple-touch-icon", sizes="180x180", href="/apple-touch-icon.png")
    add("link", rel="stylesheet", href="/assets/site.css")
    add("link", rel="manifest", href="/site.webmanifest")
    add("meta", property="og:type", content="website")
    add("meta", property="og:site_name", content="TMbilet")
    add("meta", property="og:title", content=title)
    add("meta", property="og:description", content=description)
    add("meta", property="og:url", content=canonical)
    add("meta", property="og:image", content=f"{SITE}/tmbilet-logo-search.png")
    for obj in (breadcrumb, faq_schema):
        s = page.new_tag("script", type="application/ld+json")
        s.string = json.dumps(obj, ensure_ascii=False, indent=2)
        head.append(s)

    if header: body.append(BeautifulSoup(str(header), "html.parser"))

    main = page.new_tag("main", attrs={"class": "wrap"})
    main["style"] = "padding:48px 32px;"

    nav = page.new_tag("nav", attrs={"aria-label": "Breadcrumb"})
    nav["style"] = "font-size:13px;color:var(--text-muted);margin-bottom:24px;"
    nav.append(BeautifulSoup('<a href="/">Home</a> \u203a <a href="/flights/">Flights</a> \u203a ', "html.parser"))
    cur = page.new_tag("span", attrs={"aria-current": "page"})
    cur.string = f"{from_a['city']} to {to_a['city']}"
    nav.append(cur)
    main.append(nav)

    h1 = page.new_tag("h1")
    h1.string = f"Cheap Flights from {from_a['city']} to {to_a['city']} ({from_code} \u2192 {to_code})"
    main.append(h1)

    p = page.new_tag("p")
    p.string = (
        f"{facts['airlines']} operate nonstop flights between {from_a['city']} and {to_a['city']}, "
        f"typically on the {facts['aircraft']}, with {facts['frequency']}. "
        f"{facts['tz_note']}"
    )
    main.append(p)

    if search_form:
        wrap = page.new_tag("div"); wrap["style"] = "margin:32px 0;"
        wrap.append(BeautifulSoup(str(search_form), "html.parser"))
        main.append(wrap)
        # Pre-fill the real form fields with this route, using the exact
        # value/dataset.code pattern app.js itself uses on selection
        # (see DESTINATIONS click handler in app.js) — additive only,
        # doesn't touch app.js.
        prefill = page.new_tag("script")
        prefill.string = f"""
document.addEventListener('DOMContentLoaded', function () {{
  var f = document.getElementById('fromInput');
  var t = document.getElementById('toInput');
  if (f) {{ f.value = {json.dumps(from_a['city'])}; f.dataset.code = {json.dumps(from_code)}; }}
  if (t) {{ t.value = {json.dumps(to_a['city'])}; t.dataset.code = {json.dumps(to_code)}; }}
}});
""".strip()
        main.append(prefill)

    facts_h2 = page.new_tag("h2"); facts_h2.string = "Route facts"
    main.append(facts_h2)
    ul = page.new_tag("ul")
    for label, key in [("Flight time", "duration"), ("Distance", "distance"),
                        ("Airlines", "airlines"), ("Aircraft", "aircraft")]:
        li = page.new_tag("li"); li.string = f"{label}: {facts[key]}"
        ul.append(li)
    main.append(ul)

    rel_h2 = page.new_tag("h2"); rel_h2.string = "Related searches"
    main.append(rel_h2)
    rel_ul = page.new_tag("ul")
    other_slug = f"{slugify(to_a['city'])}-to-{slugify(from_a['city'])}"
    li = page.new_tag("li")
    a = page.new_tag("a", href=f"/flights/{other_slug}")
    a.string = f"Flights from {to_a['city']} to {from_a['city']}"
    li.append(a)
    rel_ul.append(li)
    main.append(rel_ul)

    body.append(main)
    if footer: body.append(BeautifulSoup(str(footer), "html.parser"))

    if config_script: body.append(BeautifulSoup(str(config_script), "html.parser"))
    for s in src_scripts:
        body.append(BeautifulSoup(str(s), "html.parser"))
    if date_picker_script: body.append(BeautifulSoup(str(date_picker_script), "html.parser"))

    out_dir = OUT_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "index.html"
    out_path.write_text(str(page), encoding="utf-8")
    return out_path


def main():
    template = BeautifulSoup(SRC_HTML.read_text(encoding="utf-8"), "html.parser")
    for from_code, to_code in ROUTES:
        path = build_page(template, from_code, to_code)
        print(f"built {from_code}->{to_code}: {path}")


if __name__ == "__main__":
    main()
