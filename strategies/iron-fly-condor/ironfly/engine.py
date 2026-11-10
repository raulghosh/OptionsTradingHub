"""Ties feed -> regime -> structure -> sizing, and positions -> management actions.
Signals only. Nothing here talks to an order endpoint."""
from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from pathlib import Path

from .config import Config, DTEProfile, PROFILES
from .events import load as load_events
from .feeds import MarketFeed, Snapshot
from .manage import Action, Position, evaluate, reprice
from .regime import Regime, classify, pick_expiry
from .risk import size, kill_switch
from .structure import Structure, build_condor, build_fly


@dataclass
class ScanResult:
    ts: str
    profile: str
    regime: Regime
    structure: Structure | None
    contracts: int
    sizing_notes: list[str]
    kill: list[str]

    def entry_signal(self) -> bool:
        return bool(self.structure and self.contracts > 0 and not self.kill and not self.structure.notes)

    def to_dict(self):
        return {"ts": self.ts, "profile": self.profile, "regime": self.regime.to_dict(),
                "structure": self.structure.to_dict() if self.structure else None, "contracts": self.contracts,
                "sizing_notes": self.sizing_notes, "kill": self.kill, "entry": self.entry_signal()}


class Engine:
    def __init__(self, feed: MarketFeed | None, cfg: Config | None = None, profile: str = "weekly", journal: str | None = "signals.jsonl",
                 marks: str | None = None):
        self.feed, self.cfg, self.profile = feed, cfg or Config(), PROFILES[profile]
        self.events = load_events(self.cfg.events_file)
        self.journal = Path(journal) if journal else None
        self.marks_path = Path(marks) if marks else None
        self._marks = json.loads(self.marks_path.read_text()) if self.marks_path and self.marks_path.exists() else {}
        self._snap: Snapshot | None = None

    def snapshot(self, refresh=False) -> Snapshot:
        if self._snap is None or refresh:
            if self.feed is None:
                raise RuntimeError("no feed; call set_snapshot()")
            self._snap = self.feed.snapshot()
        return self._snap

    def set_snapshot(self, snap: Snapshot) -> None:
        """Drive the engine from an external snapshot (replay / backtest)."""
        self._snap = snap

    def scan(self, positions: list[Position] | None = None, daily_pnl_usd: float | None = None) -> ScanResult:
        """daily_pnl_usd=None: computed from the tracked positions (see daily_pnl); a number overrides it."""
        snap = self.snapshot()
        regime = classify(snap, self.cfg, self.profile, self.events)
        computed = self.daily_pnl(positions or [])
        kill = kill_switch(regime, computed if daily_pnl_usd is None else daily_pnl_usd, self.cfg)
        structure, n, notes = None, 0, []
        if regime.strategy != "NONE" and not kill:
            expiry = pick_expiry(snap, self.profile)
            structure = (build_fly if regime.strategy == "IRON_FLY" else build_condor)(snap, expiry, self.cfg, self.profile)
            if structure:
                open_risk, open_delta = self._exposure(positions or [], snap)
                n, notes = size(structure, regime, self.cfg, open_risk, open_delta, len(positions or []))
        res = ScanResult(snap.ts.isoformat(), self.profile.name, regime, structure, n, notes, kill)
        self._log({"kind": "scan", **res.to_dict()})
        return res

    def manage(self, positions: list[Position]) -> dict[str, list[Action]]:
        snap = self.snapshot()
        self.daily_pnl(positions)   # keep the day's marks current so the next scan's kill switch sees them
        regime = classify(snap, self.cfg, self.profile, self.events)
        out = {}
        for p in positions:
            prof = PROFILES.get(p.profile, self.profile)
            try:
                out[p.id] = evaluate(p, snap, regime, self.cfg, prof, self.events)
            except ValueError as e:
                out[p.id] = [Action("DATA_ERROR", "INFO", str(e))]
            self._log({"kind": "manage", "ts": snap.ts.isoformat(), "position": p.id, "actions": [a.to_dict() for a in out[p.id]]})
        return out

    def _exposure(self, positions: list[Position], snap: Snapshot) -> tuple[float, float]:
        risk, delta = 0.0, 0.0
        for p in positions:
            try:
                _, legs = reprice(p.legs, snap, date.fromisoformat(p.expiry), self.cfg)
                w = max(abs(l.strike - m.strike) for l in legs for m in legs if l.cp == m.cp)
                risk += (w - p.entry_credit) * 100 * p.contracts
                delta += sum(l.qty * l.delta for l in legs) * 100 * p.contracts
            except ValueError:
                pass
        return risk, delta

    def daily_pnl(self, positions: list[Position]) -> float:
        """Today's P&L in USD on tracked positions, marked at close cost (mid + slippage).

        Baseline per position is its last mark from a previous day (so run manage/scan near the close
        to make that the prior close); a position opened today starts from its entry credit (0); one
        first seen today with no earlier mark starts from its current mark. Positions dropped from
        positions.json today keep their last mark, so a stop-out still counts toward the day's loss.
        ponytail: marks at our own close-cost model, not broker fills; ~ the broker's day P&L when
        snapshots run close to the bell. Upgrade path: read day P&L from the broker's positions API."""
        snap = self.snapshot()
        today = snap.ts.date().isoformat()
        m = self._marks
        if m.get("date") != today:
            base = m.get("last", {})
            ids = {p.id for p in positions}
            m.update(date=today, baseline=base, last={k: v for k, v in base.items() if k in ids})
        for p in positions:
            try:
                cost, _ = reprice(p.legs, snap, date.fromisoformat(p.expiry), self.cfg)
            except ValueError:
                continue                     # no quote: keep its last mark
            now = float((p.entry_credit - cost) * 100 * p.contracts)
            if p.id not in m["baseline"]:
                m["baseline"][p.id] = 0.0 if p.entry_ts[:10] == today else now
            m["last"][p.id] = now
        if self.marks_path:
            self.marks_path.write_text(json.dumps(m, indent=1))
        return round(sum(v - m["baseline"].get(k, 0.0) for k, v in m["last"].items()), 2)

    def _log(self, rec: dict):
        if self.journal:
            with self.journal.open("a") as f:
                f.write(json.dumps(rec, default=str) + "\n")
