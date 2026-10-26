# Trading_Hub

One site for everything trading: live signal modules, investor knowledge, and a personal blog.
Static HTML/CSS/JS with no build tooling, so it can be hosted anywhere (GitHub Pages works as-is).
Data is published into it by one local script.

```
Home
├── Options Trading
│   ├── Iron Fly & Iron Condor   live   (signals from ../IronFlyTrading)
│   └── Calendar Spreads         planned
├── Learn                        Markdown articles in content/learn/
└── Blog                         Markdown posts in content/blog/
```

## Run it locally

```bash
python3 build.py                  # index content + publish ironfly signals (synthetic demo data)
python3 build.py --feed schwab    # live signals; needs SCHWAB_ACCESS_TOKEN
python3 -m http.server 8000       # then open http://localhost:8000
```

Pages are fetched over HTTP, so open the site through a server, not by double-clicking `index.html`.
`build.py` imports the engine from `../IronFlyTrading` (override with `IRONFLY_PATH`) and uses that
repo's `config.json` and `positions.json` when present. It runs the weekly and monthly profiles;
0DTE is deliberately left out.

## Add content

Create a Markdown file with front matter, then rerun `python3 build.py`:

```markdown
---
title: My trade review
date: 2026-10-30            # blog: newest first
order: 3                    # learn: lowest first
summary: One line shown in listings.
tags: iron condor, review
draft: true                 # optional; hidden from listings
---

Body in Markdown. Tables, lists and code blocks all render.
```

- Blog posts go in `content/blog/`, articles in `content/learn/`. The filename is the URL slug.

## Add a module

1. Add an entry to `MODULES` at the top of `assets/app.js` (`status: 'live'` or `'planned'`).
2. Add a route in `ROUTES` and a render function that reads its data from `data/<module>.json`.
3. Have `build.py` write that JSON.

## Publish

Commit and push the folder to a GitHub repo, then turn on Pages (Settings → Pages → deploy from
`main`, root). Rerun `python3 build.py --feed schwab` and push whenever you want fresh signals on
the public page; anything in `data/` is what visitors see.

Files: `index.html` (shell), `assets/style.css`, `assets/app.js` (router, pages, dashboard),
`build.py` (publisher), `content/` (Markdown + generated `index.json`), `data/` (generated module data).
