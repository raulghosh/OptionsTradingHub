/* Trading_Hub: hash-routed static site. No build step; content and module data are JSON/Markdown
   files published by build.py. Add a module: append to MODULES and add a route. */
'use strict';

const MODULES = [
  { section: 'options', slug: 'ironfly', title: 'Iron Fly & Iron Condor', status: 'live',
    blurb: 'SPX regime signals for short-premium iron butterflies and condors: entry, sizing, adjustment, roll and exit.' },
  { section: 'options', slug: 'calendar', title: 'Calendar Spreads', status: 'planned',
    blurb: 'Term-structure signals for long calendars: when the front month is rich against the back.' },
];

const STRAT = { IRON_FLY: 'Iron Fly', IRON_CONDOR: 'Iron Condor', NONE: 'No trade' };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? '—' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 0) => (x === null || x === undefined) ? '—' : `${fmt(x * 100, d)}%`;
const usd = (x) => (x === null || x === undefined) ? '—' : `$${Math.round(x).toLocaleString('en-US')}`;
const when = (iso) => iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const day = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';

const cache = new Map();
async function getJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`${url} returned ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(url); throw e; }));
  }
  return cache.get(url);
}
async function getText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.text();
}
const content = () => getJSON('content/index.json');
const ironflyData = () => getJSON('data/ironfly.json');

/* ---------------- pages ---------------- */

async function home() {
  const [idx, fly] = await Promise.all([content(), ironflyData().catch(() => null)]);
  const live = MODULES.filter((m) => m.status === 'live').length;
  const w = fly?.profiles?.weekly, m = fly?.profiles?.monthly;
  const today = fly ? `
    <a class="card" href="#/options/ironfly">
      <h3>Today's SPX premium signal</h3>
      <div class="signal" style="margin-top:10px">
        ${[['Weekly', w], ['Monthly', m]].map(([n, p]) => p ? `<div><div class="small muted">${n}</div>
          <span class="strategy ${p.regime.strategy}" style="font-size:1.05rem;padding:4px 10px">${STRAT[p.regime.strategy]}</span>
          <span class="entry ${p.entry ? 'yes' : 'no'} small">${p.entry ? 'Entry signal' : 'No entry'}</span></div>` : '').join('')}
      </div>
      <div class="meta">As of ${esc(when(fly.as_of))} · ${esc(fly.source)}</div>
    </a>` : '';
  return `
    <section class="hero">
      <h1>Trading<span class="brand-us">_</span>Hub</h1>
      <p class="lede">Signals, research and notes for systematic options trading, in one place.</p>
    </section>
    <div class="grid" style="margin-top:20px">
      ${today}
      <a class="card" href="#/options"><h3>Options Trading</h3><p>Rule-based signal modules for defined-risk SPX structures.</p>
        <div class="meta">${live} live · ${MODULES.length - live} planned</div></a>
      <a class="card" href="#/learn"><h3>Learn</h3><p>Investor knowledge on options structures, volatility and risk.</p>
        <div class="meta">${idx.learn.length} articles</div></a>
      <a class="card" href="#/blog"><h3>Blog</h3><p>Personal notes, trade reviews and lessons.</p>
        <div class="meta">${idx.blog.length} posts</div></a>
    </div>
    ${idx.blog.length ? `<h2>Latest posts</h2>${listing('blog', idx.blog.slice(0, 3))}` : ''}`;
}

function options() {
  return `
    <div class="crumbs"><a href="#/">Home</a></div>
    <h1>Options Trading</h1>
    <p class="lede">Each module watches one strategy and tells you when the environment supports it, how to size it, and what to do once it is on.</p>
    <div class="grid" style="margin-top:20px">
      ${MODULES.filter((m) => m.section === 'options').map((m) => `
        <a class="card" href="#/options/${m.slug}">
          <h3>${esc(m.title)} <span class="badge ${m.status}">${m.status}</span></h3>
          <p>${esc(m.blurb)}</p>
        </a>`).join('')}
    </div>`;
}

function calendar() {
  return `
    <div class="crumbs"><a href="#/">Home</a> / <a href="#/options">Options Trading</a></div>
    <h1>Calendar Spreads <span class="badge planned">planned</span></h1>
    <p class="lede">A long calendar sells a near-dated option and buys a later-dated one at the same strike. It is long vega and short gamma: it earns when the front month decays faster than the back and the back month's implied volatility holds or rises.</p>
    <div class="card prose" style="margin-top:16px">
      <h3>What this module will signal</h3>
      <ul>
        <li><strong>Entry</strong> when the front expiry is rich against the back (for example, a scheduled event inside the front expiry) and overall IV rank is low to moderate.</li>
        <li><strong>Strike</strong> at the expected pin, using open interest and the expected move.</li>
        <li><strong>Exit</strong> on a profit target, on the front expiry's event passing, or when spot leaves the tent.</li>
        <li><strong>Adjust</strong> by rolling the strike toward spot or converting to a double calendar.</li>
      </ul>
      <p class="muted small">It will reuse the Iron Fly module's data feeds, event calendar and recorded snapshots.</p>
    </div>`;
}

function listing(section, items) {
  if (!items.length) return '<p class="muted">Nothing here yet.</p>';
  return `<ul class="list">${items.map((it) => `
    <li><a href="#/${section}/${esc(it.slug)}">${esc(it.title)}</a>
      ${it.date ? `<span class="muted small"> · ${esc(day(it.date))}</span>` : ''}
      ${it.summary ? `<p class="summary">${esc(it.summary)}</p>` : ''}
      ${it.tags?.length ? `<div style="margin-top:6px">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </li>`).join('')}</ul>`;
}

const SECTION = {
  learn: { title: 'Learn', lede: 'Investor knowledge on options: structures, greeks, volatility and risk management.' },
  blog: { title: 'Blog', lede: 'Personal notes, trade reviews and lessons learned.' },
};

async function sectionList(section) {
  const idx = await content();
  return `<div class="crumbs"><a href="#/">Home</a></div>
    <h1>${SECTION[section].title}</h1><p class="lede">${SECTION[section].lede}</p>
    <div style="margin-top:20px">${listing(section, idx[section])}</div>`;
}

async function article(section, slug) {
  const idx = await content();
  const meta = idx[section].find((x) => x.slug === slug);
  if (!meta) return notFound();
  const md = (await getText(`content/${section}/${slug}.md`)).replace(/^---\n[\s\S]*?\n---\n/, '');
  const body = window.marked ? window.marked.parse(md) : `<pre>${esc(md)}</pre>`;
  return `<div class="crumbs"><a href="#/">Home</a> / <a href="#/${section}">${SECTION[section].title}</a></div>
    <article class="prose">
      <h1>${esc(meta.title)}</h1>
      ${meta.date ? `<p class="muted small">${esc(day(meta.date))}</p>` : ''}
      ${body}
    </article>`;
}

/* ---------------- iron fly dashboard ---------------- */

function checklist(items) {
  return `<ul class="checks">${items.map(([label, ok, val]) => {
    const cls = ok === null ? 'na' : ok ? 'ok' : 'fail';
    const sym = ok === null ? '–' : ok ? '✓' : '✕';
    return `<li><span class="${cls}" aria-label="${cls === 'ok' ? 'passes' : cls === 'fail' ? 'fails' : 'no data'}">${sym}</span><span>${label}</span><span class="val">${val}</span></li>`;
  }).join('')}</ul>`;
}

function gates(g, c) {
  const has = (x) => x !== null && x !== undefined;
  const fly = [
    [`Score ≥ ${c.min_score}`, g.fly_score >= c.min_score, fmt(g.fly_score, 2)],
    [`IV rank ≥ ${c.fly_min_ivr}`, g.ivr >= c.fly_min_ivr, fmt(g.ivr, 0)],
    [`VIX percentile ≤ ${c.fly_max_ivp}`, g.ivp <= c.fly_max_ivp, fmt(g.ivp, 0)],
    ['VIX 3-day EMA falling', c.fly_need_vol_falling ? !!g.vol_falling : null, has(g.vix_ema3) ? `${fmt(g.vix_ema3, 2)} ${g.vol_falling ? '↓' : '↑'}` : '—'],
    [`SKEW percentile ≤ ${c.fly_max_skew_pct}`, has(g.skew_pct) ? g.skew_pct <= c.fly_max_skew_pct : null, fmt(g.skew_pct, 0)],
    [`ADX ≤ ${c.fly_max_adx}`, g.adx <= c.fly_max_adx, fmt(g.adx, 1)],
    [`|Distance from 20d mean| ≤ ${c.fly_max_sma_z} ATR`, Math.abs(g.sma_z) <= c.fly_max_sma_z, fmt(g.sma_z, 2)],
  ];
  const condor = [
    [`Score ≥ ${c.min_score}`, g.condor_score >= c.min_score, fmt(g.condor_score, 2)],
    [`IV rank ≥ ${c.condor_min_ivr}`, g.ivr >= c.condor_min_ivr, fmt(g.ivr, 0)],
    [`ADX ≤ ${c.condor_max_adx}`, g.adx <= c.condor_max_adx, fmt(g.adx, 1)],
    [`|Distance from 20d mean| ≤ ${c.condor_max_sma_z} ATR`, Math.abs(g.sma_z) <= c.condor_max_sma_z, fmt(g.sma_z, 2)],
    ['VIX below VIX3M (contango)', has(g.ts_ratio) ? g.ts_ratio <= c.max_ts_ratio : null, fmt(g.ts_ratio, 3)],
    ['Implied above realized (VRP > 0)', g.vrp >= c.min_vrp, fmt(g.vrp, 1)],
    [`VVIX ≤ ${c.max_vvix}`, has(g.vvix) ? g.vvix <= c.max_vvix : null, fmt(g.vvix, 0)],
  ];
  return `<div class="two">
    <div class="card"><h3>Iron fly gates</h3>${checklist(fly)}</div>
    <div class="card"><h3>Iron condor gates</h3>${checklist(condor)}</div></div>`;
}

function vixChart(ch) {
  if (!ch || ch.vix.length < 2) return '';
  const W = 640, H = 170, P = { l: 34, r: 8, t: 10, b: 22 };
  const all = [...ch.vix, ...ch.ema, ch.p75];
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
  const x = (i) => P.l + (i / (ch.vix.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (arr) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => `<text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(v)}</text>
    <line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/>`).join('');
  const n = ch.dates.length;
  const dl = [0, Math.floor(n / 2), n - 1].map((i) => `<text x="${x(i)}" y="${H - 5}" font-size="11" fill="var(--muted)" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(day(ch.dates[i]))}</text>`).join('');
  return `<div class="card chart"><h3>VIX, last ${n} sessions</h3>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="VIX daily close with 3-day EMA and the 75th percentile line">
      ${ticks}
      <line x1="${P.l}" x2="${W - P.r}" y1="${y(ch.p75)}" y2="${y(ch.p75)}" stroke="var(--bad)" stroke-dasharray="5 4" stroke-width="1.2"/>
      <polyline points="${line(ch.vix)}" fill="none" stroke="var(--chart-1)" stroke-width="1.8"/>
      <polyline points="${line(ch.ema)}" fill="none" stroke="var(--chart-2)" stroke-width="1.4"/>
      ${dl}
    </svg>
    <div class="legend"><span><i class="swatch" style="background:var(--chart-1)"></i>VIX close</span>
      <span><i class="swatch" style="background:var(--chart-2)"></i>3-day EMA</span>
      <span><i class="swatch" style="background:var(--bad)"></i>1-year 75th percentile (${fmt(ch.p75, 1)}): fly ceiling</span></div>
  </div>`;
}

function structureCard(s, contracts, sizing) {
  if (!s) return '';
  const legs = s.legs.map((l) => `<tr>
      <td class="${l.qty < 0 ? 'short' : 'long'}">${l.qty < 0 ? 'Sell' : 'Buy'}</td>
      <td>${fmt(l.strike, 0)} ${l.cp === 'P' ? 'Put' : 'Call'}</td>
      <td>${fmt(l.price, 2)}</td><td>${fmt(l.iv, 1)}</td><td>${fmt(l.delta, 2)}</td></tr>`).join('');
  return `<h2>Proposed ${esc(STRAT[s.kind])} · expires ${esc(day(s.expiry))} (${fmt(s.dte, 1)} days)</h2>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Side</th><th>Leg</th><th>Mid</th><th>IV</th><th>Delta</th></tr></thead><tbody>${legs}</tbody></table></div>
    <dl class="kv" style="margin-top:16px">
      <div><dt>Credit</dt><dd>${fmt(s.credit, 2)}</dd></div>
      <div><dt>Credit ÷ width</dt><dd>${pct(s.credit_to_width)}</dd></div>
      <div><dt>Max loss per contract</dt><dd>${usd(s.max_loss * 100)}</dd></div>
      <div><dt>Breakevens</dt><dd>${fmt(s.be_lo, 0)} – ${fmt(s.be_hi, 0)}</dd></div>
      <div><dt>Probability of profit</dt><dd>${pct(s.pop)}</dd></div>
      <div><dt>Contracts</dt><dd>${contracts}</dd></div>
      <div><dt>Half-life</dt><dd>${fmt(s.half_life_days, 1)} d</dd></div>
      <div><dt>Expected days to target</dt><dd>${fmt(s.days_to_target, 1)} d</dd></div>
      <div><dt>Planned hold</dt><dd>${fmt(s.planned_hold_days, 1)} d</dd></div>
      <div><dt>Theta per day</dt><dd>${usd(s.theta * 100 * Math.max(contracts, 1))}</dd></div>
    </dl>
    ${sizing?.length ? `<p class="muted small">Sizing: ${esc(sizing.join('; '))}</p>` : ''}
    ${s.notes?.length ? `<div class="notice warn">${s.notes.map(esc).join('<br>')}</div>` : ''}`;
}

function positionsTable(ps) {
  if (!ps?.length) return `<h2>Open positions</h2><p class="muted">No positions. Record one with <code>python -m ironfly paper-open</code> in the engine repo, or add it to <code>positions.json</code>.</p>`;
  const rows = ps.map((p) => {
    const a = p.actions[0] || {};
    const d = a.details || {};
    return `<tr><td>${esc(p.id)}</td><td>${esc(STRAT[p.kind] || p.kind)}</td><td>${esc(day(p.expiry))}</td>
      <td>${p.contracts}</td><td>${d.pnl_usd !== undefined ? usd(d.pnl_usd) : '—'}</td>
      <td>${d.pnl_frac !== undefined ? pct(d.pnl_frac) : '—'}</td>
      <td>${p.actions.map((x) => `<div><span class="urg ${esc(x.urgency)}">${esc(x.urgency)}</span> <strong>${esc(x.type)}</strong> <span class="muted">${esc(x.reason)}</span></div>`).join('')}</td></tr>`;
  }).join('');
  return `<h2>Open positions</h2><div class="table-wrap"><table class="data">
    <thead><tr><th>ID</th><th>Structure</th><th>Expiry</th><th>Qty</th><th>P&amp;L</th><th>Of credit</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function ironfly(m) {
  let data;
  try { data = await ironflyData(); } catch (e) {
    return `<div class="crumbs"><a href="#/">Home</a> / <a href="#/options">Options Trading</a></div><h1>Iron Fly &amp; Iron Condor</h1>
      <div class="notice bad">No signal data published yet. Run <code>python3 build.py</code> in the Trading_Hub folder. (${esc(e.message)})</div>`;
  }
  const profiles = Object.keys(data.profiles);
  const prof = profiles.includes(m.query.p) ? m.query.p : profiles[0];
  const r = data.profiles[prof], g = r.regime, c = data.config;
  const synthetic = String(data.source).startsWith('synthetic');
  return `
    <div class="crumbs"><a href="#/">Home</a> / <a href="#/options">Options Trading</a></div>
    <h1>Iron Fly &amp; Iron Condor</h1>
    <p class="muted small">SPX ${fmt(data.spot, 2)} · VIX ${fmt(data.vix, 2)} · as of ${esc(when(data.as_of))} · source ${esc(data.source)}</p>
    ${synthetic ? '<div class="notice warn">Demo data: these numbers come from the synthetic feed, not the market. Publish live signals with <code>python3 build.py --feed schwab</code>.</div>' : ''}
    <nav class="tabs" aria-label="Expiry profile">${profiles.map((p) => `<a href="#/options/ironfly?p=${p}" class="${p === prof ? 'active' : ''}">${p[0].toUpperCase() + p.slice(1)}</a>`).join('')}</nav>

    <div class="card" style="margin-top:12px">
      <div class="signal">
        <span class="strategy ${g.strategy}">${STRAT[g.strategy]}</span>
        <span class="entry ${r.entry ? 'yes' : 'no'}">${r.entry ? '● Entry signal' : 'No entry'}</span>
        <span class="muted small">Fly score ${fmt(g.fly_score, 2)} · Condor score ${fmt(g.condor_score, 2)}</span>
      </div>
      ${r.kill?.length ? `<div class="notice bad">${r.kill.map(esc).join('<br>')}</div>` : ''}
      ${g.vetoes.length ? `<div style="margin-top:14px"><div class="small muted">Vetoes (block every entry)</div><ul class="pills veto">${g.vetoes.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>` : ''}
      ${g.warnings.length ? `<div style="margin-top:10px"><div class="small muted">Warnings</div><ul class="pills warn">${g.warnings.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>` : ''}
      ${g.events.length ? `<p class="small muted" style="margin:10px 0 0">Upcoming events: ${g.events.map(esc).join(', ')}</p>` : ''}
    </div>

    <h2>Regime</h2>
    <dl class="kv">
      <div><dt>IV rank / percentile</dt><dd>${fmt(g.ivr, 0)} / ${fmt(g.ivp, 0)}</dd></div>
      <div><dt>VIX − realized 20d</dt><dd>${fmt(g.vrp, 1)}</dd></div>
      <div><dt>VIX ÷ VIX3M</dt><dd>${fmt(g.ts_ratio, 3)}</dd></div>
      <div><dt>VVIX</dt><dd>${fmt(g.vvix, 0)}</dd></div>
      <div><dt>CBOE SKEW (pct)</dt><dd>${fmt(g.skew_index, 1)} (${fmt(g.skew_pct, 0)})</dd></div>
      <div><dt>ADX 14</dt><dd>${fmt(g.adx, 1)}</dd></div>
      <div><dt>From 20d mean (ATR)</dt><dd>${fmt(g.sma_z, 2)}</dd></div>
      <div><dt>ATM IV · 1σ move</dt><dd>${fmt(g.atm_iv, 1)} · ±${fmt(g.expected_move, 0)}</dd></div>
    </dl>
    <div style="margin-top:16px">${vixChart(data.vix_chart)}</div>
    <h2>Why this strategy</h2>
    ${gates(g, c)}
    ${structureCard(r.structure, r.contracts, r.sizing_notes)}
    ${positionsTable(data.positions)}
    <p class="muted small" style="margin-top:28px">Signals only. The engine never places orders. Thresholds are practitioner heuristics; calibrate them on recorded data before relying on them.</p>`;
}

function notFound() {
  return `<h1>Not found</h1><p class="muted">That page does not exist. <a href="#/">Go home</a>.</p>`;
}

/* ---------------- router ---------------- */

const ROUTES = [
  [/^\/?$/, home],
  [/^\/options$/, options],
  [/^\/options\/ironfly$/, ironfly],
  [/^\/options\/calendar$/, calendar],
  [/^\/(learn|blog)$/, (m) => sectionList(m[1])],
  [/^\/(learn|blog)\/([\w-]+)$/, (m) => article(m[1], m[2])],
];

async function render() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const top = path.split('/')[1] || '';
  document.querySelectorAll('nav a[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === top));
  const app = $('#app');
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    m.query = query;
    try { app.innerHTML = await fn(m); } catch (e) {
      app.innerHTML = `<h1>Something went wrong</h1><div class="notice bad">${esc(e.message)}</div>
        <p class="muted">If you opened index.html directly from disk, serve the folder instead: <code>python3 -m http.server 8000</code>.</p>`;
    }
    const h1 = app.querySelector('h1')?.cloneNode(true);
    h1?.querySelectorAll('.badge').forEach((b) => b.remove());
    document.title = h1 && path !== '/' ? `${h1.textContent.trim()} · Trading_Hub` : 'Trading_Hub';
    window.scrollTo(0, 0);
    return;
  }
  app.innerHTML = notFound();
}
window.addEventListener('hashchange', render);
render();
