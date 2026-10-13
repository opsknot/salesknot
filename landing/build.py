#!/usr/bin/env python3
"""Builds the salesknot.app marketing site into landing/public/.

Run:  python3 landing/build.py
Pages are plain HTML (fast, crawlable). Shared CSS/JS live in landing/src/.
"""
import json, os, shutil, html
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public")
SITE = "https://salesknot.app"
DEMO = "https://opsknot.com/contact/booking/"
SIGNIN = "https://my.salesknot.app"
TODAY = date.today().isoformat()
VER = TODAY.replace("-", "")

def esc(s): return html.escape(s, quote=True)

CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'

def mark(uid="m"):
    """The SalesKnot mark: two interlocked rings on a gradient tile."""
    return f'''<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset=".55" stop-color="#7c5cf6"/><stop offset="1" stop-color="#a855f7"/></linearGradient><radialGradient id="{uid}h" cx=".22" cy=".12" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient><clipPath id="{uid}t"><circle cx="32" cy="23.3" r="7.5"/></clipPath><clipPath id="{uid}b"><circle cx="32" cy="40.7" r="7.5"/></clipPath><mask id="{uid}A" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="-10" y="-10" width="84" height="84" fill="#fff"/><circle cx="39.5" cy="32" r="11.5" fill="none" stroke="#000" stroke-width="10" clip-path="url(#{uid}t)"/></mask><mask id="{uid}B" maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84"><rect x="-10" y="-10" width="84" height="84" fill="#fff"/><circle cx="24.5" cy="32" r="11.5" fill="none" stroke="#000" stroke-width="10" clip-path="url(#{uid}b)"/></mask></defs><rect width="64" height="64" rx="16" fill="url(#{uid}g)"/><rect width="64" height="64" rx="16" fill="url(#{uid}h)"/><g fill="none" stroke-width="5.6" transform="rotate(-32 32 32)"><circle cx="24.5" cy="32" r="11.5" stroke="#fff" mask="url(#{uid}A)"/><circle cx="39.5" cy="32" r="11.5" stroke="#b9f3ff" mask="url(#{uid}B)"/></g></svg>'''

EDITIONS = [
    dict(slug="real-estate-crm", name="Real Estate", emo="🏙️", live=True,
         nav="Properties, showings, buyer stages",
         blurb="Properties, showings, buyer stages and agency dashboards."),
    dict(slug="travel-agency-crm", name="Travel & Tours", emo="✈️", live=False,
         nav="Enquiries, packages, bookings",
         blurb="Enquiries, packages, travellers, bookings and payment schedules."),
    dict(slug="law-firm-crm", name="Legal", emo="⚖️", live=False,
         nav="Matters, clients, deadlines",
         blurb="Matters, clients, deadlines, documents and billable follow-ups."),
    dict(slug="import-export-crm", name="Import & Export", emo="🚢", live=False,
         nav="Buyers, suppliers, shipments",
         blurb="Buyers, suppliers, quotations, shipments and documents."),
]

# ---------------------------------------------------------------- layout

def header(active):
    def cur(k): return ' aria-current="page"' if active == k else ""
    eds = "".join(f'<a href="/editions/{e["slug"]}/"><span class="e">{e["emo"]}</span><span><b>{esc(e["name"])} CRM</b><small>{esc(e["nav"])}</small></span></a>' for e in EDITIONS)
    eds += '<a href="/editions/"><span class="e">✦</span><span><b>All editions</b><small>Compare what each one adds</small></span></a>'
    meds = "".join(f'<a class="sub2" href="/editions/{e["slug"]}/">{e["emo"]} {esc(e["name"])}</a>' for e in EDITIONS)
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="SalesKnot home">{mark("hd")}<span>Sales<span class="k">Knot</span></span></a>
    <nav class="links" aria-label="Main">
      <a href="/features/"{cur("features")}>Features</a>
      <div class="dd"><button aria-haspopup="true">Editions</button><div class="menu">{eds}</div></div>
      <a href="/pricing/"{cur("pricing")}>Pricing</a>
      <a href="/faq/"{cur("faq")}>FAQ</a>
      <a href="/about/"{cur("about")}>About</a>
      <a href="{SIGNIN}">Sign in</a>
      <a class="btn btn-main btn-sm" href="{DEMO}">Book a demo</a>
    </nav>
    <button class="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button>
  </div>
  <nav class="mnav" aria-label="Mobile">
    <a href="/features/">Features</a><a href="/editions/">Editions</a>{meds}
    <a href="/pricing/">Pricing</a><a href="/faq/">FAQ</a><a href="/about/">About</a><a href="{SIGNIN}">Sign in</a>
    <a class="btn btn-main" href="{DEMO}">Book a demo</a>
  </nav>
</header>'''

def footer():
    eds = "".join(f'<li><a href="/editions/{e["slug"]}/">{esc(e["name"])} CRM</a></li>' for e in EDITIONS)
    return f'''<footer class="foot">
  <div class="wrap">
    <div class="fgrid">
      <div><a class="brand" href="/">{mark("ft")}<span>Sales<span class="k">Knot</span></span></a>
        <p>The automation-first CRM. One flat price for your whole team, set up and supported by OpsKnot.</p></div>
      <div><h4>Product</h4><ul><li><a href="/features/">Features</a></li><li><a href="/features/#automation">Workflow automation</a></li><li><a href="/features/#ai-agents">AI agents</a></li><li><a href="/pricing/">Pricing</a></li><li><a href="{SIGNIN}">Sign in</a></li></ul></div>
      <div><h4>Editions</h4><ul>{eds}</ul></div>
      <div><h4>Company</h4><ul><li><a href="/about/">About</a></li><li><a href="/faq/">FAQ</a></li><li><a href="{DEMO}">Book a demo</a></li><li><a href="https://opsknot.com/salesknot/">OpsKnot</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="mailto:info@opsknot.com">info@opsknot.com</a></li><li><a href="https://www.linkedin.com/company/opsknot/">LinkedIn</a></li><li><a href="https://opsknot.com/privacy-policy/">Privacy</a></li><li><a href="https://opsknot.com/terms/">Terms</a></li></ul></div>
    </div>
    <div class="fbot"><span>© <span id="y">2026</span> SalesKnot by OpsKnot. All rights reserved.</span><span>For teams in the US, UK, UAE and worldwide.</span></div>
  </div>
</footer>'''

def page(path, title, desc, body, active="", schema=None, crumbs=None, og_title=None):
    url = SITE + path
    ld = [
        {"@context": "https://schema.org", "@type": "Organization", "@id": SITE + "/#org", "name": "SalesKnot",
         "url": SITE + "/", "logo": SITE + "/_site/icon-512.png", "email": "info@opsknot.com",
         "parentOrganization": {"@type": "Organization", "name": "OpsKnot", "url": "https://opsknot.com/"},
         "sameAs": ["https://opsknot.com/salesknot/", "https://www.linkedin.com/company/opsknot/"]},
    ]
    if crumbs:
        items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}]
        for i, (n, p) in enumerate(crumbs, start=2):
            items.append({"@type": "ListItem", "position": i, "name": n, "item": SITE + p})
        ld.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items})
    ld += schema or []
    ld_html = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    ot = og_title or title
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#05070f">
<meta property="og:site_name" content="SalesKnot">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(ot)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/_site/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SalesKnot: the automation-first CRM">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(ot)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{SITE}/_site/og.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/_site/site.css?v={VER}">
{ld_html}
</head>
<body>
<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="gridbg" aria-hidden="true"></div>
{header(active)}
<main id="main">
{body}
</main>
{footer()}
<script src="/_site/site.js?v={VER}" defer></script>
</body>
</html>
'''

# ---------------------------------------------------------------- building blocks

def phero(kicker, h1, lead, crumbs, extra="", center=False, ctas=True):
    cr = '<nav class="crumbs in-load" aria-label="Breadcrumb"><a href="/">Home</a>' + "".join(
        f'<span><a href="{p}">{esc(n)}</a></span>' for n, p in crumbs) + "</nav>"
    c = f'<div class="ctas in-load" style="--d:.4s"><a class="btn btn-main" href="{DEMO}">Book a demo <span class="arr">→</span></a><a class="btn btn-ghost" href="/pricing/">See pricing</a></div>' if ctas else ""
    return f'''<div class="phero{' center' if center else ''}"><div class="wrap">
{cr}{extra}
<div class="in-load" style="--d:.08s;margin-top:22px"><span class="kicker">{kicker}</span></div>
<h1 class="in-load" style="--d:.16s">{h1}</h1>
<p class="lead in-load" style="--d:.28s">{lead}</p>
{c}
</div></div>'''

def faq_block(items, groups=None):
    def q(qq, a):
        return f'<div class="q"><button aria-expanded="false">{esc(qq)}<span class="pl"></span></button><div class="a"><div><p>{a}</p></div></div></div>'
    if groups:
        inner = "".join(f'<h3 class="grp">{esc(g)}</h3>' + "".join(q(a, b) for a, b in its) for g, its in groups)
    else:
        inner = "".join(q(a, b) for a, b in items)
    return f'<div class="faq" data-r>{inner}</div>'

def faq_schema(items):
    import re
    strip = lambda s: re.sub("<[^>]+>", "", s)
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in items]}

def final(h="Put your pipeline<br><span class=\"grad\">on autopilot.</span>", sub="Bring your spreadsheet or current CRM. We'll show you SalesKnot running your sales process, and what it would cost."):
    return f'''<div class="final"><div class="wrap">
<h2 data-r>{h}</h2>
<p class="sub" data-r style="--d:.1s">{sub}</p>
<div class="ctas" data-r style="--d:.2s;justify-content:center"><a class="btn btn-main" href="{DEMO}">Book a demo <span class="arr">→</span></a><a class="btn btn-ghost" href="{SIGNIN}">Sign in</a></div>
</div></div>'''

def icon(name):
    paths = {
        "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
        "spark": '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/><circle cx="12" cy="12" r="3"/>',
        "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        "board": '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
        "link": '<path d="M9 7H6a3 3 0 0 0 0 6h3M15 7h3a3 3 0 0 1 0 6h-3M8 10h8"/>',
        "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        "lock": '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        "layers": '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
        "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.6 4 6"/>',
        "upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
        "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
        "phone": '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    }
    return f'<div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg></div>'

def checks(items):
    return '<ul class="checks">' + "".join(f"<li>{CHECK}<span>{i}</span></li>" for i in items) + "</ul>"

def ed_cards(link=True):
    out = []
    for i, e in enumerate(EDITIONS):
        tag = '<span class="tag on">Available</span>' if e["live"] else '<span class="tag">Coming soon</span>'
        out.append(f'<a class="ed{" live" if e["live"] else ""}" href="/editions/{e["slug"]}/" data-r style="--d:{i*0.1:.1f}s"><div><span class="emo" aria-hidden="true">{e["emo"]}</span><h3>{esc(e["name"])} CRM</h3><p>{esc(e["blurb"])}</p><span class="tlink">Explore <span>→</span></span>{tag}</div></a>')
    return '<div class="eds">' + "".join(out) + "</div>"

FLOW = '''<div class="flow">
<div class="node t pulse" style="--pd:0s"><small>Trigger</small><b>New lead from website</b></div><div class="wire"></div>
<div class="node a pulse" style="--pd:1s"><small>AI agent</small><b>Qualify &amp; score</b></div><div class="wire"></div>
<div class="node x pulse" style="--pd:2s"><small>Action</small><b>Assign &amp; send email</b></div></div>'''

CHART = '''<div class="chart" data-r="left">
<div class="legend"><span><i style="background:#f472b6"></i>Per-seat CRM</span><span><i style="background:#7aa2ff"></i>SalesKnot</span></div>
<svg viewBox="0 0 520 260" role="img" aria-label="Illustration: per-seat CRM cost rises with team size while SalesKnot stays flat">
<defs><linearGradient id="fp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f472b6" stop-opacity=".25"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></linearGradient></defs>
<g stroke="rgba(255,255,255,.07)"><line x1="40" y1="20" x2="510" y2="20"/><line x1="40" y1="80" x2="510" y2="80"/><line x1="40" y1="140" x2="510" y2="140"/><line x1="40" y1="200" x2="510" y2="200"/></g>
<line x1="40" y1="230" x2="510" y2="230" stroke="rgba(255,255,255,.18)"/>
<path d="M40 215 L510 30 L510 230 L40 230Z" fill="url(#fp)"/>
<path class="draw" d="M40 215 L510 30" stroke="#f472b6" stroke-width="3" fill="none" stroke-linecap="round"/>
<path class="draw" d="M40 168 L510 168" stroke="#7aa2ff" stroke-width="3" fill="none" stroke-linecap="round" style="transition-delay:.4s"/>
<text x="40" y="252" fill="#8189ab" font-size="12">1 user</text><text x="510" y="252" fill="#8189ab" font-size="12" text-anchor="end">50 users</text>
<text x="30" y="24" fill="#8189ab" font-size="12" text-anchor="end">$</text></svg>
<small>Illustration. Your SalesKnot price is quoted per company after a short call.</small></div>'''

PLAN = f'''<div class="plan" data-r="right" style="--d:.15s"><div>
<h3>SalesKnot</h3><div class="big">One flat price, whole team</div>
<ul>{"".join(f"<li>{CHECK}{t}</li>" for t in ["Add users freely, the price stays the same", "Workflows and AI agents included", "Setup and data import done for you", "Your own workspace and address", "Support from the people who set it up"])}</ul>
<a class="btn btn-main" href="{DEMO}">Get your price <span class="arr">→</span></a></div></div>'''

STEPS = '''<div class="steps" data-r>
<div class="step"><div class="num">1</div><h3>Book a demo</h3><p>See SalesKnot and walk us through how your team sells today.</p></div>
<div class="step"><div class="num">2</div><h3>We set it up</h3><p>Your workspace, edition, fields and automations, with your data imported.</p></div>
<div class="step"><div class="num">3</div><h3>Your team goes live</h3><p>Everyone signs in at yourcompany.salesknot.app. We stay on hand.</p></div></div>'''

# ---------------------------------------------------------------- FAQ content (shared)

FAQ_GENERAL = [
    ("What is SalesKnot?", "SalesKnot is an automation-first CRM for sales teams. It keeps your leads, contacts, companies and deals in one place, and uses workflows and AI agents to handle routine follow-up automatically. It is built and supported by OpsKnot."),
    ("What does automation-first mean?", "Most CRMs wait for someone to type. SalesKnot is set up so routine work happens on its own: new leads are assigned, follow-ups are scheduled, records are updated and reminders go out, with AI agents handling the repetitive steps."),
    ("Who is SalesKnot for?", "Small and mid-sized sales teams that want a CRM working for them rather than another tool to update, especially in real estate, travel, legal services and import/export. We work with teams in the United States, United Kingdom, UAE and worldwide."),
    ("Do I need an industry edition?", "No. The standard CRM covers companies, people, deals, tasks, notes, workflows and dashboards. An edition adds the records and dashboards your sector uses, such as properties and showings for real estate. See <a href=\"/editions/\">all editions</a>."),
]
FAQ_PRICING = [
    ("How is SalesKnot priced?", "One flat monthly price per company, not per user, so adding salespeople doesn't raise your bill. Setup, data import and custom automations are quoted up front after a short call. See <a href=\"/pricing/\">pricing</a>."),
    ("Is there a per-user fee?", "No. Your price covers your whole team. You can add users without changing your plan."),
    ("Is there a setup fee?", "Setup depends on how much we configure for you: your edition, custom fields, automations and how much data we import. We quote it as a fixed amount before we start."),
    ("Can I cancel?", "Yes. Your data stays yours, and you can export it at any time, including if you decide to leave."),
]
FAQ_DATA = [
    ("Is my data kept separate from other customers?", "Yes. Each company gets its own workspace and its own address, with its own users and data. Connections are encrypted with HTTPS."),
    ("Can I export my data?", "Yes. You can export your records at any time, and the API gives you full programmatic access."),
    ("Can SalesKnot run on our own server?", "Yes. Most teams use our hosted service, but we can install and maintain SalesKnot on a server you control if your policy requires it."),
    ("Can you move us from HubSpot, Salesforce, Zoho or spreadsheets?", "Yes. We import your contacts, companies and deals and rebuild the key automations, so your team starts with its history in place."),
]
FAQ_PRODUCT = [
    ("Does SalesKnot work with Gmail and Outlook?", "Yes. Connect Google Workspace or Microsoft 365 and emails and meetings are matched to the right contacts and deals."),
    ("Can I add my own fields and records?", "Yes. You can add custom fields, new record types (such as properties or shipments), and your own views and dashboards, without code."),
    ("Does it have an API?", "Yes. SalesKnot has REST and GraphQL APIs plus webhooks, so your website, ad platforms and other tools can send and receive data."),
    ("Does it work on mobile?", "Yes. SalesKnot runs in any modern browser on desktop, tablet and phone."),
]

# ---------------------------------------------------------------- pages

def home():
    mock = f'''<div class="stage" id="stage">
<div class="app" id="app" aria-hidden="true">
<div class="app-top"><i></i><i></i><i></i><span class="u">yourcompany.salesknot.app</span></div>
<div class="app-body">
<div class="side"><div class="ws">{mark("ws")}Acme Realty</div><div class="it">Companies</div><div class="it">People</div><div class="it on">Opportunities</div><div class="it">Properties</div><div class="it">Tasks</div><div class="it">Workflows</div><div class="it">Dashboards</div></div>
<div class="board" id="board">
<div class="col"><h5>New lead <span>3</span></h5><div class="deal"><b>Corporate retreat</b><div class="m"><span class="v">$18k</span><span class="av" style="background:#0ea5e9">JL</span></div></div><div class="deal"><b>Downtown loft</b><div class="m"><span class="v">$310k</span><span class="av" style="background:#f59e0b">RK</span></div></div></div>
<div class="col"><h5>Qualified <span>2</span></h5><div class="deal"><b>Office lease, Dubai</b><div class="m"><span class="v">$96k</span><span class="av" style="background:#8b5cf6">AM</span></div></div><div class="deal"><b>Family tour, Italy</b><div class="m"><span class="v">$12k</span><span class="av" style="background:#ec4899">SN</span></div></div></div>
<div class="col"><h5>Proposal <span>1</span></h5><div class="deal"><b>Marina penthouse</b><div class="m"><span class="v">$1.2M</span><span class="av" style="background:#10b981">DT</span></div></div></div>
<div class="col"><h5>Won <span>1</span></h5><div class="deal"><b>Annual import contract</b><div class="m"><span class="v">$240k</span><span class="av" style="background:#6366f1">KW</span></div></div></div>
<div class="deal mover" id="mover"><b>Harbor View 2BR</b><div class="m"><span class="v">$420k</span><span class="av" style="background:#4f7cff">AI</span></div></div>
</div></div>
<div class="toast" id="toast"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></span><div><b id="toastT">Workflow ran</b><small id="toastS">Lead assigned · welcome email sent</small></div></div>
</div>
<div class="ai" id="ai"><div class="h"><i>✦</i>AI agent</div><p id="aiText"></p></div>
</div>'''
    inds = ["Real Estate", "Travel &amp; Tours", "Legal", "Import &amp; Export", "Agencies", "Consultancies", "B2B Sales"]
    body = f'''<div class="hero wrap">
<div class="in-load" style="--d:.05s"><a class="badge" href="/editions/real-estate-crm/"><b>New</b> Real Estate edition is live</a></div>
<h1 class="in-load" style="--d:.15s">Your pipeline,<br><span class="grad">on autopilot.</span></h1>
<p class="lead in-load" style="--d:.3s">SalesKnot is the automation-first CRM. Workflows and AI agents capture every lead, follow up on time and keep deals moving, with no per-user fees.</p>
<div class="ctas in-load" style="--d:.45s"><a class="btn btn-main" href="{DEMO}">Book a demo <span class="arr">→</span></a><a class="btn btn-ghost" href="/features/">Explore features</a></div>
<div class="trust in-load" style="--d:.6s"><span>{CHECK}No per-user fees</span><span>{CHECK}Set up for you</span><span>{CHECK}Your data, exportable any time</span></div>
{mock}
</div>
<div class="marquee" aria-label="Industries we serve"><div class="track">{"".join(f"<span>{i}</span>" for i in inds*2)}</div></div>

<section style="padding-top:110px;padding-bottom:0"><div class="wrap">
<div class="stats" data-r>
<div class="stat"><strong class="grad">$0</strong><span>per-user fees, ever</span></div>
<div class="stat"><strong>1</strong><span>flat price for your whole team</span></div>
<div class="stat"><strong>24/7</strong><span>workflows following up for you</span></div>
<div class="stat"><strong>Days</strong><span>to go live, not months</span></div>
</div></div></section>

<section><div class="wrap">
<div data-r><span class="kicker">Automation first</span></div>
<h2 data-r style="--d:.08s">A CRM that does the <span class="grad nw">follow-up</span> for you.</h2>
<p class="sub" data-r style="--d:.16s">Most CRMs wait for someone to type. SalesKnot runs the routine steps on its own, the moment something happens.</p>
<div class="bento">
<div class="cell c4" data-r>{icon("bolt")}<h3>Workflows that never forget</h3><p>When a lead arrives, a deal moves or a date passes, SalesKnot assigns, reminds, emails and updates records automatically.</p>{FLOW}</div>
<div class="cell c2" data-r style="--d:.1s">{icon("spark")}<h3>AI agents for the busywork</h3><p>Agents set up for your process summarise records, draft follow-ups and keep data tidy.</p><a class="tlink" href="/features/#ai-agents">How AI agents work <span>→</span></a></div>
<div class="cell c2" data-r>{icon("mail")}<h3>Email &amp; calendar synced</h3><p>Google Workspace or Microsoft 365, logged on the right deal.</p><div class="mail"><div><i></i>Re: Viewing on Saturday</div><div><i></i>Proposal signed ✓</div></div></div>
<div class="cell c2" data-r style="--d:.1s">{icon("board")}<h3>Pipeline at a glance</h3><p>Boards, tables and dashboards that update the moment anything changes.</p></div>
<div class="cell c2" data-r style="--d:.2s">{icon("link")}<h3>Connects to everything</h3><p>Website forms, ad leads and your other tools flow in through the API and webhooks.</p><div class="chips"><span>Web forms</span><span>Webhooks</span><span>REST &amp; GraphQL</span></div></div>
</div>
<div class="center" data-r style="margin-top:40px"><a class="btn btn-ghost" href="/features/">See every feature <span class="arr">→</span></a></div>
</div></section>

<section class="tight"><div class="wrap">
<div class="center"><div data-r><span class="kicker">Industry editions</span></div>
<h2 data-r style="--d:.08s">Starts out knowing <span class="grad">your industry.</span></h2>
<p class="sub" data-r style="--d:.16s">Each edition adds the records, stages and dashboards your sector uses, ready on day one.</p></div>
{ed_cards()}
</div></section>

<section><div class="wrap">
<div data-r><span class="kicker">Pricing</span></div>
<h2 data-r style="--d:.08s">Grow your team.<br><span class="grad">Not your bill.</span></h2>
<p class="sub" data-r style="--d:.16s">Per-seat CRMs charge more every time you hire. SalesKnot is one flat monthly price per company.</p>
<div class="price">{CHART}{PLAN}</div>
</div></section>

<section class="tight"><div class="wrap center">
<div data-r><span class="kicker">How it works</span></div>
<h2 data-r style="--d:.08s">Live in days. <span class="grad">Not months.</span></h2>
{STEPS}
</div></section>

<section class="tight"><div class="wrap">
<div class="center"><div data-r><span class="kicker">Questions</span></div><h2 data-r style="--d:.08s">Good questions.</h2></div>
{faq_block(FAQ_GENERAL[:2] + FAQ_PRICING[:1] + FAQ_DATA[:1])}
<div class="center" data-r style="margin-top:36px"><a class="tlink" href="/faq/">All questions <span>→</span></a></div>
</div></section>
{final()}'''
    faqs = FAQ_GENERAL[:2] + FAQ_PRICING[:1] + FAQ_DATA[:1]
    schema = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": "SalesKnot", "url": SITE + "/"},
        {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "SalesKnot",
         "applicationCategory": "BusinessApplication", "applicationSubCategory": "CRM", "operatingSystem": "Web",
         "url": SITE + "/", "image": SITE + "/_site/og.png",
         "description": "Automation-first CRM with workflows, AI agents and industry editions, priced per company rather than per user.",
         "featureList": ["Workflow automation", "AI agents", "Sales pipeline", "Email and calendar sync", "Custom objects and fields", "Dashboards", "REST and GraphQL API", "Webhooks"],
         "publisher": {"@id": SITE + "/#org"}},
        faq_schema(faqs),
    ]
    return page("/", "SalesKnot: Automation-First CRM with No Per-User Fees",
                "The automation-first CRM. Workflows and AI agents follow up on every lead, with editions for real estate, travel and more. One flat price, no per-user fees.",
                body, "home", schema, og_title="SalesKnot: your pipeline on autopilot")

def features():
    rows = [
        ("automation", "Workflow automation", "Follow-up that runs <span class=\"grad\">itself.</span>",
         "Build workflows that react to what happens in your CRM: a new lead, a deal changing stage, a date arriving or a form being submitted. SalesKnot does the next step, every time.",
         ["Triggers on new or updated records, schedules, forms and webhooks", "Assign owners, create tasks, update fields and send emails", "Branch on conditions, like deal size or lead source", "Call other tools with HTTP requests and custom code steps"],
         f'<div class="visual" data-r="right">{FLOW}<div class="vrow" style="margin-top:22px"><span><b>Stage changed → Proposal</b><br><small>Create follow-up task in 2 days</small></span><span class="pill g">Ran 214×</span></div><div class="vrow"><span><b>Every Monday 9:00</b><br><small>Email owners their stale deals</small></span><span class="pill b">Scheduled</span></div></div>'),
        ("ai-agents", "AI agents", "AI that handles the <span class=\"grad\">busywork.</span>",
         "AI agents are steps in your workflows that read a record, think, and act. We set them up around your process, so they do the repetitive work your team would otherwise put off.",
         ["Qualify and score new leads from what they wrote", "Summarise long email threads onto the deal", "Draft personalised follow-ups for review", "Clean and complete records: names, companies, next steps"],
         '<div class="visual" data-r="right"><div class="vrow"><span><b>✦ Lead scored: Hot</b><br><small>Budget stated, timeline this month, decision maker</small></span><span class="pill v">AI agent</span></div><div class="vrow"><span><b>✦ Summary added to deal</b><br><small>12 emails condensed into 4 lines</small></span><span class="pill v">AI agent</span></div><div class="vrow"><span><b>✦ Follow-up drafted</b><br><small>Waiting for Aisha to review and send</small></span><span class="pill a">Review</span></div></div>'),
        ("pipeline", "Pipeline & deals", "See every deal <span class=\"grad\">at a glance.</span>",
         "Track opportunities on a board or in a table, with stages that match how you sell. Filter, sort and save views for each team, and drag a deal forward to update it.",
         ["Kanban boards and spreadsheet-style tables", "Saved views per team, owner or region", "Amounts, close dates, owners and next steps on every deal", "Full history of every change and activity"],
         '<div class="visual" data-r="right"><div class="vrow"><span><b>Qualified</b><br><small>8 deals</small></span><span class="pill b">$684k</span></div><div class="vrow"><span><b>Proposal</b><br><small>5 deals</small></span><span class="pill v">$1.9M</span></div><div class="vrow"><span><b>Negotiation</b><br><small>3 deals</small></span><span class="pill a">$740k</span></div><div class="vrow"><span><b>Won this month</b><br><small>6 deals</small></span><span class="pill g">$1.1M</span></div></div>'),
        ("email", "Email & calendar", "Every conversation, <span class=\"grad\">in context.</span>",
         "Connect Google Workspace or Microsoft 365. Emails and meetings are matched to the right people, companies and deals, so anyone can pick up where a colleague left off.",
         ["Gmail and Outlook sync", "Calendar events linked to contacts and deals", "Choose what is shared with the team and what stays private", "Send emails from workflows"],
         '<div class="visual" data-r="right"><div class="mail" style="margin-top:0"><div><i></i>Re: Viewing on Saturday · Harbor View 2BR</div><div><i></i>Proposal signed ✓ · Office lease, Dubai</div><div><i></i>Meeting booked · Thu 14:00 with Daniel</div><div><i></i>Quote request · Annual import contract</div></div></div>'),
        ("customise", "Custom objects & fields", "A CRM shaped to <span class=\"grad\">your business.</span>",
         "Add your own record types, fields and relations without code. Properties, trips, matters, shipments: whatever your business tracks, SalesKnot can hold it and automate around it.",
         ["Custom objects and relations", "Text, number, currency, date, select, rating, links and more", "Page layouts and views for each object", "Roles that control who sees and edits what"],
         '<div class="visual" data-r="right"><div class="code"><span class="c"># Property</span>\n<span class="k">address</span>      <span class="s">"12 Marina Walk"</span>\n<span class="k">price</span>        <span class="s">$1,200,000</span>\n<span class="k">bedrooms</span>     <span class="s">3</span>\n<span class="k">status</span>       <span class="s">Available</span>\n<span class="k">agent</span>        → <span class="s">Aisha Malik</span>\n<span class="k">showings</span>     → <span class="s">4 booked</span></div></div>'),
        ("dashboards", "Dashboards", "Know your numbers, <span class=\"grad\">live.</span>",
         "Dashboards update as your team works. See pipeline value, conversion by source, activity by owner and what's closing this month, without exporting to a spreadsheet.",
         ["Charts and totals from any object", "Pipeline, revenue and activity views", "Per-team and per-owner breakdowns", "Shareable with the whole company"],
         '<div class="visual" data-r="right"><div class="bars"><i style="--h:42%;--d:0s"></i><i style="--h:58%;--d:.08s"></i><i style="--h:51%;--d:.16s"></i><i style="--h:72%;--d:.24s"></i><i style="--h:66%;--d:.32s"></i><i style="--h:88%;--d:.4s"></i></div><div class="vlabel"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></div>'),
        ("integrations", "API & integrations", "Connects to <span class=\"grad\">everything.</span>",
         "Send leads in from your website and ad platforms, and push updates out to the tools you already use. Developers get complete REST and GraphQL APIs.",
         ["REST and GraphQL APIs", "Webhooks on any record change", "Website and landing-page forms", "CSV import and export"],
         '<div class="visual" data-r="right"><div class="code"><span class="c">// New lead from your website</span>\n<span class="k">POST</span> /rest/people\n{\n  <span class="k">"name"</span>: <span class="s">"Daniel Reyes"</span>,\n  <span class="k">"email"</span>: <span class="s">"daniel@example.com"</span>,\n  <span class="k">"source"</span>: <span class="s">"Website"</span>\n}\n<span class="c">// → workflow assigns, scores and emails</span></div></div>'),
    ]
    out = []
    for i, (anchor, k, h, p, items, vis) in enumerate(rows):
        out.append(f'''<div class="frow{' flip' if i % 2 else ''}" id="{anchor}">
<div class="ftext"><div data-r><span class="kicker">{k}</span></div><h2 data-r style="--d:.08s">{h}</h2><p class="sub" data-r style="--d:.14s">{p}</p><div data-r style="--d:.2s">{checks(items)}</div></div>
{vis.replace('data-r="right"', 'data-r="left"') if i % 2 else vis}</div>''')
    more = [
        ("lock", "Separate, secure workspaces", "Each company gets its own workspace and address. Encrypted connections and role-based access."),
        ("users", "Unlimited users", "Add your whole team. The price is per company, not per seat."),
        ("upload", "Import in minutes", "Bring contacts, companies and deals from spreadsheets or another CRM. We can do it for you."),
        ("phone", "Works everywhere", "Runs in any modern browser on desktop, tablet and phone."),
        ("layers", "Industry editions", "Start with records and dashboards built for your sector."),
        ("globe", "Hosted or on your server", "Use our hosted service, or we run SalesKnot on infrastructure you control."),
    ]
    cards = "".join(f'<div class="cell" data-r style="--d:{(i%3)*0.08:.2f}s">{icon(ic)}<h3>{t}</h3><p>{d}</p></div>' for i, (ic, t, d) in enumerate(more))
    body = phero("Features", "Everything your sales team needs. <span class=\"grad\">Automated.</span>",
                 "Workflow automation, AI agents, pipeline management, email sync, custom objects and dashboards, in one CRM priced per company.",
                 [("Features", "/features/")]) + \
        f'<section style="padding-top:0"><div class="wrap">{"".join(out)}</div></section>' + \
        f'<section class="tight"><div class="wrap"><div class="center"><div data-r><span class="kicker">And more</span></div><h2 data-r style="--d:.08s" class="sm">Built for teams that want to sell, not admin.</h2></div><div class="cards">{cards}</div></div></section>' + \
        final()
    return page("/features/", "CRM Features: Workflow Automation, AI Agents & Pipeline | SalesKnot",
                "SalesKnot features: workflow automation, AI agents, pipeline, Gmail and Outlook sync, custom objects, dashboards and open APIs. One flat price per company.",
                body, "features", crumbs=[("Features", "/features/")])

def editions_hub():
    rows = [
        ("Records", "Companies, people, deals, tasks, notes", "+ properties, showings", "+ trips, travellers, bookings", "+ matters, deadlines", "+ shipments, quotations"),
        ("Pipeline stages", "Your sales stages", "Buyer stages", "Enquiry → booked → travelled", "Intake → engaged → closed", "Quote → order → shipped"),
        ("Dashboards", "Pipeline & activity", "Agency overview", "Bookings & revenue", "Matters & billing", "Orders & shipments"),
        ("Status", "Available", "Available", "Coming soon", "Coming soon", "Coming soon"),
    ]
    head = "<tr><th></th><th>Standard</th>" + "".join(f'<th class="{"us" if e["live"] else ""}">{esc(e["name"])}</th>' for e in EDITIONS) + "</tr>"
    trs = "".join("<tr><th scope=\"row\">" + r[0] + "</th>" + "".join(f'<td class="{"yes" if c=="Available" else ""}">{esc(c)}</td>' for c in r[1:]) + "</tr>" for r in rows)
    body = phero("Industry editions", "A CRM that already <span class=\"grad\">speaks your industry.</span>",
                 "Every SalesKnot workspace starts with the full CRM. An edition adds the records, stages, views and dashboards your sector needs, so you're productive on day one.",
                 [("Editions", "/editions/")], center=True) + \
        f'''<section style="padding-top:0"><div class="wrap">{ed_cards()}
<div class="tbl" data-r><table><thead>{head}</thead><tbody>{trs}</tbody></table></div>
<p class="sub" data-r style="margin-top:28px">Don't see your industry? Every edition starts from the same CRM, and we can shape a workspace to your process. <a class="tlink" href="{DEMO}" style="margin-top:0">Tell us what you sell <span>→</span></a></p>
</div></section>''' + final()
    schema = [{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/editions/{e['slug']}/", "name": f"{e['name']} CRM"} for i, e in enumerate(EDITIONS)]}]
    return page("/editions/", "Industry CRM Editions: Real Estate, Travel, Legal, Import/Export | SalesKnot",
                "SalesKnot industry editions add the records, pipelines and dashboards your sector uses: real estate CRM, travel agency CRM, law firm CRM and import/export CRM.",
                body, "editions", schema, crumbs=[("Editions", "/editions/")])

EDITION_PAGES = {
    "real-estate-crm": dict(
        title="Real Estate CRM with Automated Follow-Up | SalesKnot",
        desc="A real estate CRM for agencies and brokers: properties, showings, buyer stages and agency dashboards, with automated lead follow-up and AI agents. No per-user fees.",
        h1="The real estate CRM that <span class=\"grad\">follows up for you.</span>",
        lead="Track every property, buyer and showing in one place. SalesKnot assigns portal and website leads instantly, books follow-ups and keeps your agents focused on closing.",
        kicker="Real Estate CRM",
        blocks=[
            ("Properties", "Every listing with price, status, bedrooms, address and the agent responsible, linked to interested buyers and showings."),
            ("Showings", "Schedule viewings, record feedback and see each property's activity at a glance."),
            ("Buyer stages", "Move buyers from enquiry to viewing, offer and closing on a board built for agencies."),
            ("Agency overview", "A dashboard of listings, active buyers, showings this week and deals closing."),
            ("Lead routing", "Portal and website leads are assigned to the right agent by area, budget or round robin."),
            ("Automated follow-up", "Reminders after viewings, nudges for quiet buyers and alerts when a matching property lists."),
        ],
        flows=[("New enquiry from portal", "Assign to area agent, send intro email, create call task"), ("Showing completed", "Ask for feedback, schedule follow-up in 2 days"), ("Price reduced", "Notify buyers who viewed the property")],
        who=["Residential and commercial agencies", "Brokers and property consultants", "Developers selling off-plan", "Rental and leasing teams"],
        faqs=[
            ("What is a real estate CRM?", "A real estate CRM keeps your listings, buyers, sellers and showings in one system, and tracks every enquiry through to closing. SalesKnot adds automation so follow-up happens on time without agents having to remember it."),
            ("Can SalesKnot capture leads from property portals and my website?", "Yes. Website forms and portal lead emails or webhooks can create buyers in SalesKnot automatically and assign them to an agent."),
            ("Is the Real Estate edition available now?", "Yes. The Real Estate edition is live, with properties, showings, buyer stages and an agency overview dashboard."),
            ("How much does a real estate CRM cost with SalesKnot?", "SalesKnot is one flat monthly price per agency, not per agent, so adding agents doesn't raise your bill. We quote after a short call."),
        ]),
    "travel-agency-crm": dict(
        title="Travel Agency CRM for Tour Operators | SalesKnot",
        desc="A travel agency CRM for tour operators and travel consultants: enquiries, packages, travellers, bookings and payment schedules, with automated follow-up. Early access open.",
        h1="The travel CRM built for <span class=\"grad\">enquiries that convert.</span>",
        lead="Turn enquiries into booked trips. SalesKnot's Travel & Tours edition keeps every traveller, package and payment schedule together, and follows up while your team plans the trip.",
        kicker="Travel Agency CRM",
        blocks=[
            ("Enquiries", "Capture requests from your website, email and social channels with dates, destinations and budget."),
            ("Packages & quotes", "Build trips from packages and send quotes linked to the enquiry."),
            ("Travellers", "Passenger details, preferences and documents attached to each booking."),
            ("Bookings", "Confirmed trips with suppliers, dates and status in one view."),
            ("Payment schedules", "Deposits and balances with automatic reminders before due dates."),
            ("Repeat business", "Anniversary and seasonal campaigns to past travellers."),
        ],
        flows=[("New enquiry", "Assign to consultant, send brochure, follow up in 24 hours"), ("Deposit due in 3 days", "Email reminder to the traveller"), ("Trip completed", "Request a review and tag for next season's offer")],
        who=["Tour operators", "Travel agencies and consultants", "Corporate travel and MICE teams", "Hajj, Umrah and religious travel organisers"],
        faqs=[
            ("What is a travel agency CRM?", "A travel agency CRM tracks enquiries, quotes, travellers and bookings in one place, so consultants can follow up quickly and nothing slips between the enquiry and the trip."),
            ("Is the Travel & Tours edition available now?", "It is in development. You can start today on the standard SalesKnot CRM, and we'll shape your workspace for travel and move you onto the edition when it launches."),
            ("Does it handle deposits and payment reminders?", "Yes, payment schedules with automated reminders are part of the Travel & Tours edition."),
        ]),
    "law-firm-crm": dict(
        title="Law Firm CRM for Client Intake & Matters | SalesKnot",
        desc="A law firm CRM for client intake, matters, deadlines and follow-ups, with workflow automation and AI summaries. Built for small and mid-sized firms. Early access open.",
        h1="A law firm CRM that keeps <span class=\"grad\">every matter moving.</span>",
        lead="From first enquiry to signed engagement and beyond, SalesKnot's Legal edition tracks clients, matters and deadlines, and automates the reminders your team can't afford to miss.",
        kicker="Law Firm CRM",
        blocks=[
            ("Client intake", "Enquiries from your website and referrals, with conflict-check and engagement steps."),
            ("Matters", "Each matter with its client, practice area, responsible lawyer and status."),
            ("Deadlines", "Key dates with automatic reminders to the right people."),
            ("Documents", "Engagement letters and files linked to the matter."),
            ("Referral tracking", "See which sources and partners bring in work."),
            ("AI summaries", "Long email threads summarised onto the matter for quick handovers."),
        ],
        flows=[("New enquiry", "Create intake task, send acknowledgment email"), ("Deadline in 7 days", "Remind the responsible lawyer and assistant"), ("Matter closed", "Request a review and schedule a check-in")],
        who=["Small and mid-sized law firms", "Immigration and corporate practices", "Legal consultancies", "In-house teams handling external counsel"],
        faqs=[
            ("What is a law firm CRM?", "A law firm CRM manages client intake, relationships and matters, so enquiries are followed up quickly and existing clients are looked after. It complements, rather than replaces, your practice management and billing software."),
            ("Is the Legal edition available now?", "It is in development. You can start on the standard SalesKnot CRM today, and we'll move your workspace onto the Legal edition when it launches."),
            ("Is client data kept confidential?", "Each firm gets its own separate workspace with role-based access, and we can host SalesKnot on your own server if your policy requires it."),
        ]),
    "import-export-crm": dict(
        title="Import Export CRM for Traders & Distributors | SalesKnot",
        desc="An import/export CRM for traders, distributors and sourcing companies: buyers, suppliers, quotations, orders and shipments, with automated follow-up. Early access open.",
        h1="The CRM for traders who <span class=\"grad\">ship on time.</span>",
        lead="Manage buyers and suppliers across countries, follow quotations to orders, and track shipments and documents, with automation chasing every next step.",
        kicker="Import & Export CRM",
        blocks=[
            ("Buyers & suppliers", "Companies and contacts by country, product line and terms."),
            ("Quotations", "Quotes linked to the buyer, product and validity date, with follow-up reminders."),
            ("Orders", "Confirmed orders with quantities, values and delivery terms."),
            ("Shipments", "Status from booking to delivery, with dates and carriers."),
            ("Documents", "Invoices, packing lists and certificates attached to each order."),
            ("Reorder reminders", "Prompts when regular buyers are due to reorder."),
        ],
        flows=[("Quote sent", "Follow up in 3 days if no reply"), ("Shipment departed", "Email the buyer with ETA"), ("Buyer inactive 60 days", "Create reorder call task")],
        who=["Importers and exporters", "Distributors and wholesalers", "Sourcing and trading companies", "Freight-aware sales teams"],
        faqs=[
            ("What is an import/export CRM?", "An import/export CRM tracks buyers, suppliers, quotations, orders and shipments together, so traders can follow up on quotes and keep buyers informed without spreadsheets."),
            ("Is the Import & Export edition available now?", "It is in development. You can start on the standard SalesKnot CRM today, and we'll move you onto the edition when it launches."),
            ("Can it handle multiple currencies?", "Yes. Currency fields support amounts in different currencies on quotations and orders."),
        ]),
}

def edition(e):
    d = EDITION_PAGES[e["slug"]]
    status = '<div class="in-load" style="margin-top:26px"><span class="tag on">Available now</span></div>' if e["live"] else '<div class="in-load" style="margin-top:26px"><span class="tag">Coming soon · early access open</span></div>'
    extra = f'<div class="emo in-load" aria-hidden="true">{e["emo"]}</div>{status}'
    blocks = "".join(f'<div class="cell" data-r style="--d:{(i%3)*0.08:.2f}s"><h3>{esc(t)}</h3><p>{esc(p)}</p></div>' for i, (t, p) in enumerate(d["blocks"]))
    flows = "".join(f'<div class="vrow"><span><b>⚡ {esc(a)}</b><br><small>{esc(b)}</small></span><span class="pill g">Automated</span></div>' for a, b in d["flows"])
    cta_h = "See the Real Estate edition<br><span class=\"grad\">with your listings.</span>" if e["live"] else f"Get early access to<br><span class=\"grad\">{esc(e['name'])}.</span>"
    cta_s = "Book a demo and we'll show you SalesKnot running your agency's pipeline." if e["live"] else "Start on SalesKnot today and we'll shape your workspace for your industry, then move you onto the edition when it launches."
    others = "".join(f'<a class="chips" href="/editions/{o["slug"]}/" style="margin:0"><span>{o["emo"]} {esc(o["name"])} CRM</span></a>' for o in EDITIONS if o["slug"] != e["slug"])
    body = phero(d["kicker"], d["h1"], d["lead"], [("Editions", "/editions/"), (e["name"], f'/editions/{e["slug"]}/')], extra=extra) + f'''
<section style="padding-top:20px"><div class="wrap">
<div data-r><span class="kicker">What's included</span></div>
<h2 data-r style="--d:.08s" class="sm">Everything in SalesKnot, plus the records {esc(e["name"].lower())} teams use.</h2>
<div class="cards">{blocks}</div>
</div></section>
<section class="tight"><div class="wrap"><div class="frow" style="border:0;padding:0">
<div class="ftext"><div data-r><span class="kicker">Automations</span></div><h2 data-r style="--d:.08s" class="sm">Follow-up that happens <span class="grad">on its own.</span></h2><p class="sub" data-r style="--d:.14s">Examples of workflows we set up for {esc(e["name"].lower())} teams. Every one can be adjusted to your process.</p></div>
<div class="visual" data-r="right">{flows}</div>
</div></div></section>
<section class="tight"><div class="wrap"><div class="cards two">
<div class="cell" data-r><h3>Who it's for</h3>{checks(d["who"])}</div>
<div class="cell" data-r style="--d:.1s"><h3>Why teams choose SalesKnot</h3>{checks(["One flat price for your whole team, no per-user fees", "Workflows and AI agents included", "Set up, imported and supported for you", "Your data, exportable any time"])}</div>
</div></div></section>
<section class="tight"><div class="wrap"><div class="center"><div data-r><span class="kicker">Questions</span></div><h2 data-r style="--d:.08s" class="sm">{esc(e["name"])} CRM questions</h2></div>
{faq_block(d["faqs"])}
<div class="center" data-r style="margin-top:44px"><p class="sub" style="margin:0 auto 16px">Other editions</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">{others}</div></div>
</div></section>
{final(cta_h, cta_s)}'''
    schema = [faq_schema(d["faqs"]),
              {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f"SalesKnot {e['name']} CRM",
               "applicationCategory": "BusinessApplication", "applicationSubCategory": "CRM", "operatingSystem": "Web",
               "url": f"{SITE}/editions/{e['slug']}/", "description": d["desc"], "publisher": {"@id": SITE + "/#org"}}]
    return page(f'/editions/{e["slug"]}/', d["title"], d["desc"], body, "editions", schema,
                crumbs=[("Editions", "/editions/"), (f'{e["name"]} CRM', f'/editions/{e["slug"]}/')])

def pricing():
    rows = [
        ("Price model", "Per user, per month", "One flat price per company"),
        ("Adding a salesperson", "Your bill goes up", "No change"),
        ("Workflow automation", "Often limited to higher tiers", "Included"),
        ("AI agents", "Usually an extra add-on", "Included and set up for you"),
        ("Setup & data import", "Do it yourself or hire a partner", "Done for you"),
        ("Industry edition", "Build it yourself", "Included where available"),
        ("Support", "Ticket queue", "The people who set up your CRM"),
    ]
    trs = "".join(f'<tr><th scope="row">{a}</th><td>{b}</td><td class="us">{c}</td></tr>' for a, b, c in rows)
    inc = ["Unlimited users", "Pipeline, contacts, companies, tasks and notes", "Workflow automation", "AI agents", "Email and calendar sync", "Custom objects, fields and views", "Dashboards", "API and webhooks", "Your industry edition where available", "Your own workspace and address", "Onboarding and support"]
    body = phero("Pricing", "Grow your team. <span class=\"grad\">Not your bill.</span>",
                 "SalesKnot is one flat monthly price per company, with no per-user fees. Workflows, AI agents and setup are included, so the price you're quoted is the price you pay.",
                 [("Pricing", "/pricing/")], ctas=False) + f'''
<section style="padding-top:0"><div class="wrap"><div class="price" style="margin-top:0">{CHART}{PLAN}</div></div></section>
<section class="tight"><div class="wrap">
<div data-r><span class="kicker">Compare</span></div><h2 data-r style="--d:.08s" class="sm">SalesKnot vs per-seat CRMs</h2>
<div class="tbl" data-r><table><thead><tr><th></th><th>Typical per-seat CRM</th><th class="us">SalesKnot</th></tr></thead><tbody>{trs}</tbody></table></div>
</div></section>
<section class="tight"><div class="wrap"><div class="cards two">
<div class="cell" data-r><h3>Everything included</h3>{checks(inc)}</div>
<div class="cell" data-r style="--d:.1s"><h3>How we price</h3><p>Your monthly price depends on your company's size and which edition you use, never on how many people log in.</p><p style="margin-top:14px">Setup is a fixed, one-time amount based on what we configure for you: fields, automations, AI agents and data import. You get both numbers in writing after a short call.</p><a class="btn btn-main" href="{DEMO}" style="margin-top:26px">Get your price <span class="arr">→</span></a></div>
</div></div></section>
<section class="tight"><div class="wrap"><div class="center"><div data-r><span class="kicker">Questions</span></div><h2 data-r style="--d:.08s" class="sm">Pricing questions</h2></div>{faq_block(FAQ_PRICING)}</div></section>
{final("No per-user fees.<br><span class=\"grad\">Ever.</span>", "Tell us about your team and we'll send a flat price for SalesKnot, with setup quoted up front.")}'''
    return page("/pricing/", "CRM Pricing with No Per-User Fees | SalesKnot",
                "SalesKnot pricing: one flat monthly price per company with no per-user fees. Workflow automation, AI agents, setup and support included. Get your quote.",
                body, "pricing", [faq_schema(FAQ_PRICING)], crumbs=[("Pricing", "/pricing/")])

def faq():
    groups = [("General", FAQ_GENERAL), ("Pricing", FAQ_PRICING), ("Product", FAQ_PRODUCT), ("Data & security", FAQ_DATA)]
    allq = [x for _, g in groups for x in g]
    body = phero("FAQ", "Questions, <span class=\"grad\">answered.</span>",
                 "Everything teams ask us about SalesKnot: pricing, features, data, security and getting started.",
                 [("FAQ", "/faq/")], center=True, ctas=False) + \
        f'<section style="padding-top:0"><div class="wrap">{faq_block(None, groups)}</div></section>' + \
        final("Still have a question?", f"Book a short call and ask us directly, or email <a href=\"mailto:info@opsknot.com\" style=\"color:#9db5ff\">info@opsknot.com</a>.")
    return page("/faq/", "SalesKnot FAQ: Pricing, Features, Data & Security",
                "Answers to common questions about SalesKnot: how pricing works without per-user fees, workflow automation, AI agents, data security, migration and hosting.",
                body, "faq", [faq_schema(allq)], crumbs=[("FAQ", "/faq/")])

def about():
    body = phero("About", "We built the CRM we kept <span class=\"grad\">wishing for.</span>",
                 "SalesKnot is made by OpsKnot, a CRM and automation consultancy. After years of setting up CRMs that teams forgot to update, we built one that updates itself.",
                 [("About", "/about/")], ctas=False) + f'''
<section style="padding-top:0"><div class="wrap"><div class="frow" style="border:0;padding:0;align-items:start">
<div class="prose" data-r>
<p><strong>Most CRMs are expensive filing cabinets.</strong> They charge for every seat, and they only work if salespeople stop selling to type in what happened. So the data goes stale, follow-ups slip, and the CRM becomes something people avoid.</p>
<p>SalesKnot flips that. It's <strong>automation-first</strong>: workflows and AI agents capture leads, assign them, follow up and keep records tidy, so the CRM works for the team instead of the other way round.</p>
<p>And it's priced the way small and growing teams need: <strong>one flat price per company</strong>, so hiring another salesperson never means a bigger software bill.</p>
<p>We set every workspace up ourselves, import your data and stay on hand afterwards. You talk to the people who built your system, not a ticket queue.</p>
</div>
<div class="cards" style="grid-template-columns:1fr;margin-top:0">
<div class="cell" data-r="right"><h3>OpsKnot</h3><p>A CRM, automation and web consultancy led by Zahid Wakil Rao, a CRM architect since 2007 who has delivered CRM projects for teams from Lahore to Dubai.</p><a class="tlink" href="https://opsknot.com/salesknot/">Visit OpsKnot <span>→</span></a></div>
<div class="cell" data-r="right" style="--d:.1s"><h3>Who we work with</h3><p>Sales teams in the United States, United Kingdom, UAE and beyond, in real estate, travel, legal services, import/export and B2B sales.</p></div>
</div>
</div></div></section>
<section class="tight"><div class="wrap center"><div data-r><span class="kicker">How it works</span></div><h2 data-r style="--d:.08s">Live in days. <span class="grad">Not months.</span></h2>{STEPS}</div></section>
{final()}'''
    schema = [{"@context": "https://schema.org", "@type": "AboutPage", "url": SITE + "/about/", "name": "About SalesKnot", "about": {"@id": SITE + "/#org"}}]
    return page("/about/", "About SalesKnot: the Automation-First CRM by OpsKnot",
                "SalesKnot is built by OpsKnot, a CRM and automation consultancy. Learn why we made an automation-first CRM with no per-user fees.",
                body, "about", schema, crumbs=[("About", "/about/")])

def notfound():
    body = f'<div class="nf"><div><strong class="grad">404</strong><h2 class="sm" style="margin:10px auto 0">This page wandered off.</h2><p class="sub" style="margin:16px auto 0">The page you are looking for does not exist.</p><div class="ctas" style="justify-content:center"><a class="btn btn-main" href="/">Back to home</a><a class="btn btn-ghost" href="/features/">See features</a></div></div></div>'
    p = page("/404.html", "Page not found | SalesKnot", "The page you are looking for does not exist.", body)
    return p.replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">')

# ---------------------------------------------------------------- write

def write(rel, content):
    path = os.path.join(OUT, rel.lstrip("/"))
    if path.endswith("/"): path += "index.html"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f: f.write(content)

def main():
    if os.path.isdir(OUT):
        for n in os.listdir(OUT):
            if n == "_site": continue
            p = os.path.join(OUT, n)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(os.path.join(OUT, "_site"), exist_ok=True)
    for f in ("site.css", "site.js"):
        shutil.copy(os.path.join(ROOT, "src", f), os.path.join(OUT, "_site", f))
    assets = os.path.join(ROOT, "src", "_site")  # icons, logo, share image
    if os.path.isdir(assets):
        for f in os.listdir(assets): shutil.copy(os.path.join(assets, f), os.path.join(OUT, "_site", f))
    for f in ("favicon.ico", "favicon.svg", "apple-touch-icon.png", "site.webmanifest"):
        src = os.path.join(ROOT, "src", f)
        if os.path.exists(src): shutil.copy(src, os.path.join(OUT, f))

    pages = {"/": home(), "/features/": features(), "/editions/": editions_hub(), "/pricing/": pricing(),
             "/faq/": faq(), "/about/": about()}
    for e in EDITIONS: pages[f'/editions/{e["slug"]}/'] = edition(e)
    for p, c in pages.items(): write(p, c)
    write("/404.html", notfound())

    pri = {"/": "1.0", "/features/": "0.9", "/pricing/": "0.9", "/editions/": "0.8"}
    urls = "".join(f"<url><loc>{SITE}{p}</loc><lastmod>{TODAY}</lastmod><priority>{pri.get(p, '0.7')}</priority></url>" for p in pages)
    write("/sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    write("/robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    print("built", len(pages) + 1, "pages into", OUT)

if __name__ == "__main__":
    main()
