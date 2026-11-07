"""Publish content indexes and module data into the static site. Stdlib + the ironfly package.

  python3 build.py                  # content + ironfly signals on synthetic demo data
  python3 build.py --feed schwab    # live signals (needs SCHWAB_ACCESS_TOKEN)
  python3 build.py --no-ironfly     # content only

ironfly is imported from strategies/iron-fly-condor (override with IRONFLY_PATH). Its config.json
and positions.json, if present there, are used as-is.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
from dataclasses import asdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONT = re.compile(r"^---\n(.*?)\n---\n", re.S)
PROFILES = ("weekly", "monthly")   # 0DTE deliberately excluded


def front_matter(text: str) -> dict:
    m = FRONT.match(text)
    meta = {}
    for line in (m.group(1).splitlines() if m else []):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"')
    return meta


def index(section: str) -> list[dict]:
    items = []
    for p in (ROOT / "content" / section).glob("*.md"):
        meta = front_matter(p.read_text())
        if meta.get("draft", "").lower() == "true":
            continue
        items.append({"slug": p.stem, "title": meta.get("title", p.stem), "date": meta.get("date", ""),
                      "summary": meta.get("summary", ""), "order": int(meta.get("order", 999)),
                      "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]})
    if section == "learn":
        return sorted(items, key=lambda x: (x["order"], x["title"]))
    return sorted(items, key=lambda x: x["date"], reverse=True)


def _json_default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    if hasattr(o, "item"):          # numpy scalar
        return o.item()
    raise TypeError(f"not JSON serializable: {type(o)}")


def ironfly(feed_name: str) -> dict:
    path = Path(os.environ.get("IRONFLY_PATH", ROOT / "strategies" / "iron-fly-condor"))
    sys.path.insert(0, str(path))
    from ironfly import Config, Engine
    from ironfly.feeds import AlpacaFeed, SchwabFeed, SyntheticFeed
    from ironfly.manage import Position

    cfg_file, pos_file = path / "config.json", path / "positions.json"
    cfg = Config.from_json(cfg_file.read_text()) if cfg_file.exists() else Config()
    positions = [Position(**d) for d in json.loads(pos_file.read_text())] if pos_file.exists() else []
    feed = {"synthetic": SyntheticFeed, "schwab": SchwabFeed, "alpaca": AlpacaFeed}[feed_name]()
    snap = feed.snapshot()                              # one fetch, shared by every profile

    out = {"generated": datetime.now().astimezone().isoformat(timespec="seconds"), "as_of": snap.ts.isoformat(),
           "source": snap.source, "spot": snap.spot, "vix": snap.vix, "config": asdict(cfg), "profiles": {}, "positions": []}
    for prof in PROFILES:
        eng = Engine(None, cfg, prof, journal=None)
        eng.set_snapshot(snap)
        out["profiles"][prof] = eng.scan(positions).to_dict()
    if positions:
        eng = Engine(None, cfg, "weekly", journal=None)  # each position is managed under its own profile
        eng.set_snapshot(snap)
        acts = eng.manage(positions)
        out["positions"] = [{**p.to_dict(), "actions": [a.to_dict() for a in acts[p.id]]} for p in positions]

    vix = snap.history["vix"].dropna()
    ema = vix.ewm(span=cfg.vol_ema_span, adjust=False).mean()
    tail = vix.iloc[-120:]
    out["vix_chart"] = {"dates": [d.date().isoformat() for d in tail.index], "vix": [round(float(x), 2) for x in tail],
                        "ema": [round(float(x), 2) for x in ema.iloc[-120:]],
                        "p75": round(float(vix.iloc[-252:].quantile(cfg.fly_max_ivp / 100)), 2)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default="synthetic", choices=["synthetic", "schwab", "alpaca"])
    ap.add_argument("--no-ironfly", action="store_true")
    a = ap.parse_args()
    idx = {"blog": index("blog"), "learn": index("learn")}
    (ROOT / "content" / "index.json").write_text(json.dumps(idx, indent=1))
    print(f"content: {len(idx['learn'])} learn, {len(idx['blog'])} blog")
    if not a.no_ironfly:
        data = ironfly(a.feed)
        (ROOT / "data" / "ironfly.json").write_text(json.dumps(data, indent=1, default=_json_default))
        sig = {k: (v["regime"]["strategy"], v["entry"]) for k, v in data["profiles"].items()}
        print(f"ironfly: {data['source']} as of {data['as_of']}  {sig}  positions={len(data['positions'])}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        raise SystemExit(f"error: {e}")
