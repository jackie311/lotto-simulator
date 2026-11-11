#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate static, keyword-targeted SEO landing pages (and sitemap.xml) from
app/data.js. Each page targets one search intent seen in Search Console:

  /oz-lotto-number-generator    "oz lotto number generator / picker"
  /powerball-number-generator   "powerball generator australia"
  /oz-lotto-hot-cold-numbers    "oz lotto hot numbers / most common numbers"
  /oz-lotto-statistics          "oz lotto stats / statistics"

All numbers on the pages are computed from the real draw history at build
time, so the pages refresh whenever update_data.py rebuilds data.js.
Run: python build_pages.py   (also called automatically by build_data.py)
"""
import json, os, html
from collections import Counter
from itertools import combinations
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "app")
SITE = "https://www.ozlottostats.app"

PAGES = [
    ("oz-lotto-number-generator", "Oz Lotto Number Generator"),
    ("powerball-number-generator", "Powerball Number Generator"),
    ("oz-lotto-hot-cold-numbers", "Oz Lotto Hot & Cold Numbers"),
    ("oz-lotto-statistics", "Oz Lotto Statistics"),
]

e = html.escape


# ---------------------------------------------------------------- data / stats
def load_data():
    s = open(os.path.join(APP, "data.js"), encoding="utf-8").read()
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def stats(game):
    draws = game["draws"]            # newest first
    mx = game["rules"]["mainMax"]
    freq = Counter(n for d in draws for n in d["main"])
    allfreq = [(n, freq.get(n, 0)) for n in range(1, mx + 1)]
    by_freq = sorted(allfreq, key=lambda x: (-x[1], x[0]))
    recent = draws[:20]
    rfreq = Counter(n for d in recent for n in d["main"])
    hot = sorted(((n, rfreq.get(n, 0)) for n in range(1, mx + 1)),
                 key=lambda x: (-x[1], x[0]))
    gap = {}
    for n in range(1, mx + 1):
        gap[n] = next((i for i, d in enumerate(draws) if n in d["main"]), len(draws))
    cold = sorted(gap.items(), key=lambda x: (-x[1], x[0]))
    pairs = Counter(p for d in draws for p in combinations(sorted(d["main"]), 2))
    sums = [sum(d["main"]) for d in draws]
    odd = Counter(sum(1 for n in d["main"] if n % 2) for d in draws)
    extra = Counter(n for d in draws for n in d["extra"])
    return {
        "draws": draws, "n": len(draws), "max": mx,
        "first": draws[-1]["date"], "last": draws[0]["date"],
        "freq": dict(allfreq), "by_freq": by_freq, "hot": hot, "cold": cold,
        "pairs": pairs.most_common(10),
        "sum_avg": sum(sums) / len(sums), "sum_min": min(sums), "sum_max": max(sums),
        "odd": odd, "extra": extra,
        "expected": len(draws) * 7 / mx,
    }


def fmt_date(iso):
    d = datetime.strptime(iso, "%Y-%m-%d")
    return f"{d.day} {d.strftime('%b %Y')}"


# ---------------------------------------------------------------- html bits
def balls(nums, cls="main"):
    return '<span class="balls">' + "".join(f'<span class="ball sm {cls}">{n}</span>' for n in nums) + "</span>"


def table(head, rows):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tblwrap"><table class="lp-table"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<h3>{e(q)}</h3><p>{e(a)}</p>" for q, a in faqs) + "</div>"


def faq_ld(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}


def generator_widget(game, st, pb):
    """Inline client-side generator. Random mode uses crypto.getRandomValues;
    'frequency' mode weights each number by its all-time draw count."""
    cfg = {"max": st["max"], "pick": 7,
           "w": [st["freq"][n] for n in range(1, st["max"] + 1)],
           "pb": 20 if pb else 0}
    return f"""
<div class="card lp-gen">
  <div class="controls">
    <div><label for="g-mode">Method</label>
      <select id="g-mode">
        <option value="random">Pure random (every number equally likely)</option>
        <option value="freq">Weighted by all-time frequency</option>
        <option value="cold">Weighted toward least-drawn numbers</option>
      </select></div>
    <div><label for="g-lines">Lines</label>
      <select id="g-lines"><option>1</option><option selected>5</option><option>10</option><option>18</option></select></div>
    <div><button class="act" id="g-go">Generate numbers</button></div>
  </div>
  <div id="g-out" class="lp-out" aria-live="polite"></div>
  <p class="hint">Numbers are generated in your browser. No method changes your odds — every combination is equally likely.</p>
</div>
<script>
(function(){{
  var C={json.dumps(cfg)};
  function rnd(){{var a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}}
  function pick(k,max,w){{var pool=[],out=[];for(var i=1;i<=max;i++)pool.push(i);
    while(out.length<k){{var tot=0,j;for(j=0;j<pool.length;j++)tot+=w?w[pool[j]-1]:1;
      var r=rnd()*tot;for(j=0;j<pool.length;j++){{r-=w?w[pool[j]-1]:1;if(r<0)break;}}
      if(j>=pool.length)j=pool.length-1;out.push(pool.splice(j,1)[0]);}}
    return out.sort(function(a,b){{return a-b;}});}}
  function weights(m){{if(m==='freq')return C.w;if(m==='cold'){{var mx=Math.max.apply(null,C.w);
    return C.w.map(function(x){{return mx-x+1;}});}}return null;}}
  function go(){{var m=document.getElementById('g-mode').value,n=+document.getElementById('g-lines').value,h='';
    for(var i=0;i<n;i++){{var line=pick(C.pick,C.max,weights(m));
      h+='<div class="lp-line"><span class="lp-idx">'+(i+1)+'</span>'+line.map(function(x){{return '<span class="ball main">'+x+'</span>';}}).join('');
      if(C.pb)h+='<span class="lp-plus">PB</span><span class="ball pb">'+(1+Math.floor(rnd()*C.pb))+'</span>';
      h+='</div>';}}
    document.getElementById('g-out').innerHTML=h;}}
  document.getElementById('g-go').onclick=go;go();
}})();
</script>"""


def page(slug, title, desc, h1, intro, body, faqs, updated):
    url = f"{SITE}/{slug}"
    cur = ' aria-current="page"'
    nav = " · ".join(
        f'<a href="/{s}"{cur if s == slug else ""}>{e(n)}</a>' for s, n in PAGES)
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": h1, "item": url}]}
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- Auto-generated by build_pages.py — do not edit by hand. -->
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta name="theme-color" content="#0f1220" />
<link rel="canonical" href="{url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Oz Lotto Stats" />
<meta property="og:title" content="{e(title)}" />
<meta property="og:description" content="{e(desc)}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{SITE}/og-image.svg" />
<meta property="og:locale" content="en_AU" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/style.css" />
<script type="application/ld+json">{json.dumps(crumbs)}</script>
<script type="application/ld+json">{json.dumps(faq_ld(faqs))}</script>
</head>
<body>
<header>
  <div>
    <a class="lp-home" href="/">🎲 Oz Lotto Stats</a>
    <div class="sub">Free Oz Lotto &amp; Powerball statistics &amp; number generator</div>
  </div>
</header>
<nav class="lp-nav"><a href="/">Full simulator</a> · {nav}</nav>
<main class="lp">
  <h1>{e(h1)}</h1>
  <p class="hint">Updated {fmt_date(updated)} · based on real past draws</p>
  <div class="disclaimer">⚠️ Every draw is an independent random event — past results <strong>cannot</strong> predict the future. For entertainment only; never use this for betting decisions.</div>
  <div class="seo-content card">{intro}</div>
  {body}
  <section class="seo-content card">
    <h2>Frequently asked questions</h2>
    {faq_html(faqs)}
  </section>
  <section class="seo-content card">
    <h2>More free tools</h2>
    <ul class="lp-links">
      <li><a href="/">Full Oz Lotto &amp; Powerball simulator</a> — predict, generate and validate numbers against every past draw, with an honest backtest.</li>
      {"".join(f'<li><a href="/{s}">{e(n)}</a></li>' for s, n in PAGES if s != slug)}
    </ul>
  </section>
</main>
<footer class="site-footer">
  <p class="foot-strong">⚠️ For 18+ only. Lotteries are gambling — you can lose money, and no method improves your odds. Need help? <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener">Gambling Help Online</a> · 1800 858 858 (Australia, free, 24/7).</p>
  <p>Independent project — not affiliated with, authorised by, or endorsed by The Lott, Lotterywest or the Lottery Corporation. “Oz Lotto” and “Powerball” are trademarks of their respective owners. Always rely on the officially published results.</p>
</footer>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------- pages
def recent_rows(st, extra_label, n=10):
    return [(fmt_date(d["date"]), d["n"], balls(sorted(d["main"])),
             balls(d["extra"], "pb" if extra_label == "Powerball" else "extra"))
            for d in st["draws"][:n]]


def build_oz_generator(oz):
    top = oz["by_freq"]
    intro = f"""
<p>Use this <strong>free Oz Lotto number generator</strong> to pick 7 numbers from 1–47 for Tuesday’s Oz Lotto draw. Choose pure random lines, or lines weighted by how often each number has actually been drawn across the last <strong>{oz['n']} Oz Lotto draws</strong> ({fmt_date(oz['first'])} – {fmt_date(oz['last'])}).</p>
<p>This is an independent number picker, not the official Oz Lotto “Quick Pick”. You still need to enter your numbers through an authorised outlet or The Lott.</p>"""
    body = generator_widget(None, oz, pb=False) + f"""
<section class="seo-content card">
  <h2>How the Oz Lotto number picker works</h2>
  <p><strong>Pure random</strong> gives every number from 1 to 47 the same chance, exactly like the real draw machine. <strong>Weighted by frequency</strong> slightly favours numbers that have come up more often (for example {top[0][0]} has been drawn {top[0][1]} times, versus an average of {oz['expected']:.0f}). <strong>Weighted toward least-drawn</strong> does the opposite. All three methods have identical odds of winning: 1 in 62,891,499 for Division 1.</p>
  <h2>Most drawn Oz Lotto numbers</h2>
  <p>The 10 most common Oz Lotto main numbers in the current 7-from-47 format:</p>
  {table(["Number", "Times drawn"], [(balls([n]), c) for n, c in top[:10]])}
  <p>See the full breakdown on the <a href="/oz-lotto-hot-cold-numbers">Oz Lotto hot &amp; cold numbers</a> page.</p>
</section>"""
    faqs = [
        ("Is this the official Oz Lotto number generator?",
         "No. This is a free, independent number generator. The official Quick Pick is only available from The Lott and authorised outlets. You can use the numbers generated here when filling in your own ticket."),
        ("How many numbers do I pick in Oz Lotto?",
         "You pick 7 numbers from 1 to 47. Each draw also produces 3 supplementary numbers, which count toward the lower prize divisions."),
        ("Does a number generator improve my chances of winning Oz Lotto?",
         "No. Every combination has exactly the same chance — 1 in 62,891,499 for Division 1. A generator is simply a quick, unbiased way to choose numbers."),
        ("When is Oz Lotto drawn?",
         "Oz Lotto is drawn every Tuesday evening, Australian Eastern time."),
    ]
    return page("oz-lotto-number-generator",
                "Oz Lotto Number Generator – Free Random 7-Number Picker (1–47)",
                "Free Oz Lotto number generator: pick random 7-number lines from 1–47, or weight them by real draw frequency. Includes the most drawn Oz Lotto numbers. Independent tool, not affiliated with The Lott.",
                "Oz Lotto Number Generator", intro, body, faqs, oz["last"])


def build_pb_generator(pb):
    top = pb["by_freq"]
    pbtop = sorted(pb["extra"].items(), key=lambda x: (-x[1], x[0]))
    intro = f"""
<p>This <strong>free Powerball number generator for Australia</strong> picks 7 main numbers from 1–35 plus a Powerball from 1–20 for Thursday’s draw. Generate pure random lines or lines weighted by the real results of the last <strong>{pb['n']} Powerball draws</strong> ({fmt_date(pb['first'])} – {fmt_date(pb['last'])}).</p>
<p>It is an independent picker, not the official Powerball Quick Pick.</p>"""
    body = generator_widget(None, pb, pb=True) + f"""
<section class="seo-content card">
  <h2>Most drawn Powerball numbers</h2>
  <div class="row">
    <div class="grow"><h3>Main numbers (1–35)</h3>
      {table(["Number", "Times drawn"], [(balls([n]), c) for n, c in top[:10]])}</div>
    <div class="grow"><h3>Powerball (1–20)</h3>
      {table(["Powerball", "Times drawn"], [(balls([n], "pb"), c) for n, c in pbtop[:10]])}</div>
  </div>
  <h2>Latest Powerball results</h2>
  {table(["Date", "Draw", "Winning numbers", "Powerball"], recent_rows(pb, "Powerball", 5))}
</section>"""
    faqs = [
        ("How does the Powerball generator work?",
         "It picks 7 different main numbers from 1 to 35 and one Powerball from 1 to 20 in your browser. You can choose pure random lines, or weight the main numbers by how often they have been drawn."),
        ("What are the odds of winning Powerball Division 1?",
         "1 in 134,490,400 — the number of ways to choose 7 from 35, multiplied by 20 Powerball options. No generator or statistic changes this."),
        ("Is this the official Powerball Quick Pick?",
         "No. It is a free, independent tool and is not affiliated with The Lott or the Lottery Corporation."),
        ("When is Powerball drawn in Australia?",
         "Powerball is drawn every Thursday evening, Australian Eastern time."),
    ]
    return page("powerball-number-generator",
                "Powerball Number Generator Australia – Free Random Picker",
                "Free Powerball number generator for Australia: 7 main numbers (1–35) plus a Powerball (1–20). Random or frequency-weighted lines, most drawn numbers and latest results.",
                "Powerball Number Generator (Australia)", intro, body, faqs, pb["last"])


def build_hot_cold(oz):
    hot, cold, byf = oz["hot"], oz["cold"], oz["by_freq"]
    intro = f"""
<p>These are the current <strong>Oz Lotto hot and cold numbers</strong> and the <strong>most common Oz Lotto numbers</strong>, calculated from {oz['n']} draws in the current 7-from-47 format, up to the draw on {fmt_date(oz['last'])}.</p>
<p><strong>Hot numbers</strong> are the ones drawn most often in the last 20 draws. <strong>Cold numbers</strong> are the ones that have gone the longest without being drawn. Both describe the past only — they do not make any number more or less likely next Tuesday.</p>"""
    hot_rows = [(balls([n]), c) for n, c in hot[:10]]
    cold_rows = [(balls([n]), f"{g} draws" if g < oz["n"] else "never") for n, g in cold[:10]]
    full = [(balls([n]), c, f"{(c - oz['expected']) / oz['expected'] * 100:+.0f}%")
            for n, c in sorted(oz["freq"].items())]
    body = f"""
<section class="seo-content card">
  <div class="row">
    <div class="grow"><h2>🔥 Hot numbers (last 20 draws)</h2>{table(["Number", "Times drawn"], hot_rows)}</div>
    <div class="grow"><h2>❄️ Cold numbers (longest absent)</h2>{table(["Number", "Not drawn for"], cold_rows)}</div>
  </div>
  <h2>Most common Oz Lotto numbers (all draws)</h2>
  <p>Most drawn: {balls([n for n, _ in byf[:7]])}</p>
  <p>Least drawn: {balls([n for n, _ in byf[-7:]])}</p>
  <h2>Full Oz Lotto number frequency table</h2>
  <p>Each number would be expected to appear about <strong>{oz['expected']:.1f}</strong> times over {oz['n']} draws. The last column shows how far each number is above or below that.</p>
  {table(["Number", "Times drawn", "vs expected"], full)}
  <h2>Latest Oz Lotto results</h2>
  {table(["Date", "Draw", "Winning numbers", "Supplementary"], recent_rows(oz, "Supplementary", 5))}
  <p>Want to try these numbers? Use the <a href="/oz-lotto-number-generator">Oz Lotto number generator</a>, or check any set of numbers against every past draw in the <a href="/">full simulator</a>.</p>
</section>"""
    faqs = [
        ("What are the hottest Oz Lotto numbers right now?",
         f"Over the last 20 draws the most frequent main numbers are {', '.join(str(n) for n, _ in hot[:5])}. This list changes after every Tuesday draw."),
        ("What are the most common Oz Lotto numbers of all time?",
         f"In the current 7-from-47 format the most drawn numbers are {', '.join(str(n) for n, _ in byf[:5])}, and the least drawn are {', '.join(str(n) for n, _ in byf[-5:])}."),
        ("Should I play hot or cold numbers?",
         "It makes no difference to your odds. Each draw is independent, so a number that has been drawn often (hot) or rarely (cold) is exactly as likely as any other to come up next. Believing otherwise is the gambler's fallacy."),
        ("How often is this page updated?",
         "Automatically after each Tuesday Oz Lotto draw, using public official results."),
    ]
    return page("oz-lotto-hot-cold-numbers",
                "Oz Lotto Hot & Cold Numbers – Most Common Numbers (Updated Weekly)",
                f"Current Oz Lotto hot and cold numbers and the most common Oz Lotto numbers from {oz['n']} real draws, with a full frequency table. Updated after every Tuesday draw.",
                "Oz Lotto Hot & Cold Numbers", intro, body, faqs, oz["last"])


def build_statistics(oz):
    odd = oz["odd"]
    odd_rows = [(f"{k} odd / {7 - k} even", odd.get(k, 0), f"{odd.get(k, 0) / oz['n'] * 100:.1f}%")
                for k in range(8)]
    pair_rows = [(balls(list(p)), c) for p, c in oz["pairs"]]
    supp = sorted(oz["extra"].items(), key=lambda x: (-x[1], x[0]))
    intro = f"""
<p>Complete <strong>Oz Lotto statistics</strong> for Australia, calculated from <strong>{oz['n']} draws</strong> in the current format (7 main numbers from 1–47 plus 3 supplementary numbers), from {fmt_date(oz['first'])} to {fmt_date(oz['last'])}.</p>
<p>Below you will find number frequency, odd/even splits, the most common number pairs, sum ranges and the latest results. For hot and cold numbers see <a href="/oz-lotto-hot-cold-numbers">Oz Lotto hot &amp; cold numbers</a>.</p>"""
    body = f"""
<section class="seo-content card">
  <h2>Key Oz Lotto stats</h2>
  {table(["Statistic", "Value"], [
        ("Draws analysed", oz["n"]),
        ("Date range", f"{fmt_date(oz['first'])} – {fmt_date(oz['last'])}"),
        ("Most drawn number", f"{oz['by_freq'][0][0]} ({oz['by_freq'][0][1]} times)"),
        ("Least drawn number", f"{oz['by_freq'][-1][0]} ({oz['by_freq'][-1][1]} times)"),
        ("Average sum of 7 main numbers", f"{oz['sum_avg']:.1f}"),
        ("Lowest / highest sum", f"{oz['sum_min']} / {oz['sum_max']}"),
        ("Division 1 odds", "1 in 62,891,499"),
    ])}
  <h2>Odd and even number split</h2>
  {table(["Split", "Draws", "Share"], odd_rows)}
  <h2>Most common Oz Lotto number pairs</h2>
  <p>Pairs of main numbers drawn together most often:</p>
  {table(["Pair", "Times together"], pair_rows)}
  <h2>Most drawn supplementary numbers</h2>
  <p>{balls([n for n, _ in supp[:10]], "extra")}</p>
  <h2>Latest Oz Lotto results</h2>
  {table(["Date", "Draw", "Winning numbers", "Supplementary"], recent_rows(oz, "Supplementary", 10))}
</section>"""
    faqs = [
        ("How many Oz Lotto draws are included in these statistics?",
         f"{oz['n']} draws in the current 7-from-47 format, from {fmt_date(oz['first'])} to {fmt_date(oz['last'])}. Earlier draws used different rules and are excluded."),
        ("What is the most common odd/even split in Oz Lotto?",
         f"{max(odd, key=odd.get)} odd and {7 - max(odd, key=odd.get)} even numbers is the most frequent split so far. Balanced splits are common simply because there are more combinations of them."),
        ("Can Oz Lotto statistics predict the next draw?",
         "No. The statistics describe what has already happened. Every draw is random and independent, so they cannot predict future numbers."),
        ("Where does the data come from?",
         "From public official Australian lottery results, refreshed automatically after each draw. This is an independent project, not affiliated with The Lott."),
    ]
    return page("oz-lotto-statistics",
                "Oz Lotto Statistics Australia – Number Frequency, Pairs & Results",
                f"Oz Lotto statistics from {oz['n']} real draws: number frequency, odd/even split, most common pairs, sum ranges and latest results. Free and updated after every draw.",
                "Oz Lotto Statistics", intro, body, faqs, oz["last"])


def write_sitemap(lastmod):
    urls = [("", "1.0")] + [(s, "0.8") for s, _ in PAGES]
    body = "".join(
        f"  <url>\n    <loc>{SITE}/{s}</loc>\n    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>weekly</changefreq>\n    <priority>{p}</priority>\n  </url>\n"
        for s, p in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n")
    with open(os.path.join(APP, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write(xml)


def main():
    data = load_data()
    oz, pb = stats(data["ozlotto"]), stats(data["powerball"])
    out = {
        "oz-lotto-number-generator": build_oz_generator(oz),
        "powerball-number-generator": build_pb_generator(pb),
        "oz-lotto-hot-cold-numbers": build_hot_cold(oz),
        "oz-lotto-statistics": build_statistics(oz),
    }
    for slug, content in out.items():
        with open(os.path.join(APP, slug + ".html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
    write_sitemap(max(oz["last"], pb["last"]))
    print(f"Wrote {len(out)} landing pages + sitemap.xml")


if __name__ == "__main__":
    main()
