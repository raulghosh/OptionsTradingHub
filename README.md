# OptionsTradingHub

The main repo for options trading: the **Trading_Hub** website at the root, and every strategy
engine in its own folder under `strategies/`. One clone, one push, one site.

```
OptionsTradingHub/
├── index.html, assets/, content/, data/, build.py   Trading_Hub website
└── strategies/
    ├── iron-fly-condor/    SPX iron butterfly / iron condor signal engine (live)
    └── calendar/           calendar spreads (planned)
```

The site has four parts:

```
Home
├── Options Trading
│   ├── Iron Fly & Iron Condor   live   (signals from strategies/iron-fly-condor)
│   └── Calendar Spreads         planned
├── Learn                        Markdown articles in content/learn/
└── Blog                         Markdown posts in content/blog/
```

Static HTML/CSS/JS with no build tooling, so it can be hosted anywhere (GitHub Pages works as-is).
Data is published into it by one local script.

## Credentials

All keys live in one `.env` file at the repo root. It is git-ignored.

```bash
cp .env.example .env          # then fill in SCHWAB_APP_KEY and SCHWAB_APP_SECRET
cd strategies/iron-fly-condor && python3 -m ironfly schwab-login && cd ../..
```

`schwab-login` prints a Schwab consent link. Approve the app, then paste back the address your
browser lands on; the refresh token is saved into `.env`. Schwab refresh tokens last about 7 days,
so repeat this weekly. Access tokens last 30 minutes and are fetched automatically on every run.

## Run it locally

```bash
python3 build.py                  # index content + publish ironfly signals (synthetic demo data)
python3 build.py --feed schwab    # live signals; needs SCHWAB_ACCESS_TOKEN
python3 -m http.server 8000       # then open http://localhost:8000
```

Pages are fetched over HTTP, so open the site through a server, not by double-clicking `index.html`.
`build.py` imports the engine from `strategies/iron-fly-condor` (override with `IRONFLY_PATH`) and
uses that folder's `config.json` and `positions.json` when present. It runs the weekly and monthly profiles;
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

## Add a strategy

1. Put the engine in `strategies/<name>/`. To bring in an existing repo with its history:
   `git subtree add --prefix=strategies/<name> <repo-url-or-path> main`
2. Add an entry to `MODULES` at the top of `assets/app.js` (`status: 'live'` or `'planned'`).
3. Add a route in `ROUTES` and a render function that reads its data from `data/<module>.json`.
4. Have `build.py` write that JSON.

Each engine keeps its own README, tests and CLI; run them from inside its folder, for example
`cd strategies/iron-fly-condor && python3 tests/test_core.py`.

## Publish

Turn on GitHub Pages for this repo (Settings → Pages → deploy from `main`, root). The site is served
from the root; the strategy folders are ignored by the browser. Rerun `python3 build.py --feed schwab` and push whenever you want fresh signals on
the public page; anything in `data/` is what visitors see.

Files: `index.html` (shell), `assets/style.css`, `assets/app.js` (router, pages, dashboard),
`build.py` (publisher), `content/` (Markdown + generated `index.json`), `data/` (generated module data).
