#!/usr/bin/env python3
"""
localize_build.py

Pre-renders real, crawlable per-language homepage HTML from index.html +
i18n.json, using the exact same data-i18n / data-i18n-html /
data-i18n-placeholder attributes app.js already reads at runtime — so the
markup contract doesn't change, only *when* the translation happens
(build time, in addition to runtime).

Why this exists: right now the only translated content Google (or any
non-JS client, like a link-preview bot) ever sees is English, because
i18n.js only ever runs after the page loads, against a single URL. This
produces one real HTML file per language so hreflang has something
genuine to point at.

Output:
  build/index.html   (English — same URL as today, tmbilet.com/)
  build/tr/index.html
  build/ru/index.html

app.js/i18n.js/airports.js etc. are left wired up exactly as before, so
in-session language switching keeps working unchanged on top of
whichever pre-rendered variant the visitor lands on.
"""

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

SITE = "https://tmbilet.com"
SRC_HTML = Path("index.html")
I18N_JSON = Path("i18n.json")
OUT_DIR = Path("build")

# Languages actually translated in i18n.js today (7). Original brief
# scoped EN/TR/RU — building those three for real below. The loop is
# written so adding the rest later is a one-line change to LANGS.
LANGS = ["en", "tr", "ru"]

# Page-level <title>/<meta description> aren't part of the UI dictionary
# (i18n.js only holds in-app strings), so they're translated here
# instead of invented per-locale inside i18n.js.
META = {
    "en": {
        "title": "TMbilet — Fly smarter. Book better.",
        "description": "Compare and book flights across hundreds of airlines with TMbilet.",
    },
    "tr": {
        "title": "TMbilet — Daha akıllı uçun. Daha iyi rezervasyon yapın.",
        "description": "Yüzlerce havayoluna ait uçuş seçeneklerini karşılaştırın ve TMbilet ile hemen bilet ayırtın.",
    },
    "ru": {
        "title": "TMbilet — Летайте с умом. Бронируйте выгодно.",
        "description": "Сравнивайте авиабилеты сотен авиакомпаний и бронируйте рейс на TMbilet за пару минут.",
    },
}

# FAQPage content mirrors the real on-page "Why book with TMbilet"
# section (feature1_desc..feature4_desc in i18n.json) so the schema
# matches what's actually visible — translated the same way.
FAQ = {
    "en": [
        ("How does TMbilet find the best flight price?",
         "TMbilet compares fares across hundreds of airlines so you always see the option that fits your budget."),
        ("Is it safe to pay for flights on TMbilet?",
         "Yes — every booking is encrypted end to end, so your details stay protected."),
        ("When do I get my e-ticket after booking?",
         "Your e-ticket is issued the moment your booking is confirmed — no waiting, no follow-up emails."),
        ("Is support available if something goes wrong?",
         "Yes, real people are on hand any time, before and after you fly."),
    ],
    "tr": [
        ("TMbilet en uygun uçak bileti fiyatını nasıl buluyor?",
         "TMbilet, yüzlerce havayolunun fiyatlarını karşılaştırarak bütçenize en uygun seçeneği gösterir."),
        ("TMbilet üzerinden ödeme yapmak güvenli mi?",
         "Evet — her rezervasyon uçtan uca şifrelenir, bilgileriniz korunur."),
        ("E-biletim rezervasyondan sonra ne zaman gelir?",
         "E-biletiniz, rezervasyonunuz onaylandığı anda düzenlenir — bekleme yok."),
        ("Bir sorun olursa destek alabilir miyim?",
         "Evet, uçuşunuzdan önce ve sonra her zaman gerçek bir destek ekibi yanınızda."),
    ],
    "ru": [
        ("Как TMbilet находит самую выгодную цену на авиабилет?",
         "TMbilet сравнивает цены сотен авиакомпаний, чтобы вы сразу видели вариант, подходящий под ваш бюджет."),
        ("Безопасно ли оплачивать билеты на TMbilet?",
         "Да — каждое бронирование защищено сквозным шифрованием, ваши данные в безопасности."),
        ("Когда я получу электронный билет после бронирования?",
         "Электронный билет оформляется сразу после подтверждения брони — без ожидания."),
        ("Можно ли получить поддержку, если что-то пошло не так?",
         "Да, служба поддержки на связи в любое время — до и после полёта."),
    ],
}


def load_i18n():
    return json.loads(I18N_JSON.read_text(encoding="utf-8"))


def apply_translations(soup, dict_for_lang):
    for el in soup.select("[data-i18n]"):
        key = el.get("data-i18n")
        val = dict_for_lang.get(key)
        if val is not None:
            el.clear()
            el.append(NavigableString(val))

    for el in soup.select("[data-i18n-html]"):
        key = el.get("data-i18n-html")
        val = dict_for_lang.get(key)
        if val is not None:
            el.clear()
            el.append(BeautifulSoup(val, "html.parser"))

    for el in soup.select("[data-i18n-placeholder]"):
        key = el.get("data-i18n-placeholder")
        val = dict_for_lang.get(key)
        if val is not None:
            el["placeholder"] = val


def lang_path(lang):
    return "" if lang == "en" else f"/{lang}"


def build_head_additions(soup, lang):
    head = soup.head
    canonical_url = f"{SITE}{lang_path(lang)}/"

    # ---- title / description: translate in place ----
    title_tag = soup.find("title")
    if title_tag:
        title_tag.string = META[lang]["title"]
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag:
        desc_tag["content"] = META[lang]["description"]

    def add_meta(**attrs):
        tag = soup.new_tag("meta", attrs=attrs)
        head.append(tag)

    def add_link(**attrs):
        tag = soup.new_tag("link", attrs=attrs)
        head.append(tag)

    add_meta(name="robots", content="index, follow")
    add_link(rel="canonical", href=canonical_url)

    for hl in LANGS:
        add_link(rel="alternate", hreflang=hl, href=f"{SITE}{lang_path(hl)}/")
    add_link(rel="alternate", hreflang="x-default", href=f"{SITE}/")

    add_meta(property="og:type", content="website")
    add_meta(property="og:site_name", content="TMbilet")
    add_meta(property="og:title", content=META[lang]["title"])
    add_meta(property="og:description", content=META[lang]["description"])
    add_meta(property="og:url", content=canonical_url)
    add_meta(property="og:image", content=f"{SITE}/tmbilet-logo-search.png")

    add_meta(name="twitter:card", content="summary_large_image")
    add_meta(name="twitter:title", content=META[lang]["title"])
    add_meta(name="twitter:description", content=META[lang]["description"])
    add_meta(name="twitter:image", content=f"{SITE}/tmbilet-logo-search.png")

    add_link(rel="manifest", href="/site.webmanifest")

    # ---- JSON-LD: replace the single Organization-only block that
    # currently sits near the footer with an enriched set in <head>.
    for old in soup.find_all("script", attrs={"type": "application/ld+json"}):
        old.decompose()

    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "TMbilet",
        "url": f"{SITE}/",
        "logo": f"{SITE}/tmbilet-logo-search.png",
        # NOTE: footer social links are currently href="#" placeholders —
        # add real profile URLs to `sameAs` once those exist. Leaving
        # this out entirely rather than inventing URLs.
    }
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": canonical_url}
        ],
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in FAQ[lang]
        ],
    }

    for obj in (org, breadcrumb, faq):
        script = soup.new_tag("script", type="application/ld+json")
        script.string = json.dumps(obj, ensure_ascii=False, indent=2)
        head.append(script)

    # NOTE ON SearchAction: deliberately NOT adding WebSite+SearchAction
    # here. Google's sitelinks-search-box schema is documented for a
    # single free-text query box, not a multi-field flight form
    # (origin + destination + dates). Marking this form up as a
    # SearchAction would be structurally invalid for what Google
    # actually supports — see report for the corrected recommendation.


def fix_relative_asset_paths(soup):
    """
    The source index.html uses root-relative-by-accident paths like
    src="app.js" or href="tmbilet-logo.png" — fine while the file only
    ever lives at tmbilet.com/index.html, but a 404 waiting to happen
    the moment the same markup is served from /tr/ or /ru/ (it would
    resolve to /tr/app.js). Force every same-origin asset reference to
    a real absolute path, root variant included, so this class of bug
    can't come back later either.
    """
    def is_relative(url):
        return url and not url.startswith(("/", "http://", "https://", "data:", "#"))

    for el in soup.select("script[src], img[src]"):
        if is_relative(el.get("src")):
            el["src"] = "/" + el["src"]

    for el in soup.select("link[href]"):
        if is_relative(el.get("href")):
            el["href"] = "/" + el["href"]


def externalize_css(soup):
    """
    The ~35KB <style> block is currently inline and duplicated into
    every page's HTML payload. Pulling it into /assets/site.css means
    the browser downloads it once and reuses it across /, /tr/, /ru/,
    and every future /flights/... page — a real Core Web Vitals win
    (smaller HTML, cached CSS on repeat/cross-page navigation), not
    just a tidiness change. Visual output is identical either way.
    """
    style_tag = soup.find("style")
    if style_tag:
        link = soup.new_tag("link", attrs={"rel": "stylesheet", "href": "/assets/site.css"})
        style_tag.replace_with(link)


def build_lang(soup_template, lang, i18n):
    soup = BeautifulSoup(str(soup_template), "html.parser")
    soup.html["lang"] = lang
    soup.html["dir"] = "rtl" if lang == "ar" else "ltr"

    apply_translations(soup, i18n[lang])
    fix_relative_asset_paths(soup)
    externalize_css(soup)
    build_head_additions(soup, lang)

    out_path = OUT_DIR / (lang_path(lang).lstrip("/")) / "index.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(str(soup), encoding="utf-8")
    return out_path


def main():
    i18n = load_i18n()
    template = BeautifulSoup(SRC_HTML.read_text(encoding="utf-8"), "html.parser")
    OUT_DIR.mkdir(exist_ok=True)
    for lang in LANGS:
        path = build_lang(template, lang, i18n)
        print(f"built {lang}: {path}")


if __name__ == "__main__":
    main()
