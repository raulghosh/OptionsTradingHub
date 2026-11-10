"""Macro event calendar: FOMC decisions + the three scheduled data prints that move SPX vol
(CPI, the jobs report, and core PCE), plus computed monthly opex / quad witching.

Exact dates below are sourced from the official calendars: federalreserve.gov/monetarypolicy
/fomccalendars.htm (FOMC), bls.gov/schedule (CPI, Employment Situation), bea.gov/news/schedule
(Personal Income and Outlays, which contains the PCE price index). 2026 was pulled on 2026-09-13,
2027 on 2026-11-10. FOMC dates are the decision (second) day and stay tentative until confirmed at
the meeting before. Re-verify each year; the Fed and BLS publish 12-18 months ahead, BEA about a
year ahead. SEED_THROUGH is the last day every series is covered: past it NFP falls back to the
first-Friday heuristic, CPI/PCE/FOMC emit nothing rather than a bad guess, and
coverage_warning() fires so the regime output says the calendar has run out. Maintain
data/events.json for anything not seeded here (extra CPI/PCE prints, earnings, etc.)."""
from __future__ import annotations
import calendar
import json
from datetime import date, timedelta
from pathlib import Path

FOMC_2026 = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
             "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09"]

CPI_2026 = ["2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10",
            "2026-07-14", "2026-08-12", "2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10"]

NFP_2026 = ["2026-01-09", "2026-02-11", "2026-03-06", "2026-04-03", "2026-05-08", "2026-06-05",
            "2026-07-02", "2026-08-07", "2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04"]

# BEA's "Personal Income and Outlays" release, which carries the PCE price index. BEA sometimes
# runs two releases close together to catch a delayed prior month; every date below is real.
PCE_2026 = ["2026-01-22", "2026-02-20", "2026-03-13", "2026-04-09", "2026-04-30", "2026-05-28",
            "2026-06-25", "2026-07-30", "2026-08-26", "2026-09-30", "2026-10-29", "2026-11-25",
            "2026-12-23"]

# 2027: every date read off the official pages on 2026-11-10; none was marked tentative except the
# Fed's standing note that all FOMC dates are. The Dec 2027 CPI/NFP/PCE prints land in Jan 2028
# and are not published yet, so they are left out rather than guessed.
FOMC_2027 = ["2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09",
             "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08",
             "2028-01-26"]   # Jan 25-26 2028 already announced by the Fed

CPI_2027 = ["2027-01-13", "2027-02-11", "2027-03-10", "2027-04-13", "2027-05-12", "2027-06-10",
            "2027-07-14", "2027-08-11", "2027-09-14", "2027-10-14", "2027-11-10", "2027-12-10"]

NFP_2027 = ["2027-01-08", "2027-02-05", "2027-03-05", "2027-04-02", "2027-05-07", "2027-06-04",
            "2027-07-02", "2027-08-06", "2027-09-03", "2027-10-08", "2027-11-05", "2027-12-03"]

PCE_2027 = ["2027-01-28", "2027-02-25", "2027-03-31", "2027-04-29", "2027-05-27", "2027-06-25",
            "2027-07-29", "2027-08-25", "2027-09-30", "2027-10-28", "2027-11-24", "2027-12-22"]

SEED_THROUGH = date(2027, 12, 31)   # bump when the next year's dates are added

SEED = ([{"date": d, "name": "FOMC"} for d in FOMC_2026 + FOMC_2027]
        + [{"date": d, "name": "CPI"} for d in CPI_2026 + CPI_2027]
        + [{"date": d, "name": "NFP"} for d in NFP_2026 + NFP_2027]
        + [{"date": d, "name": "PCE"} for d in PCE_2026 + PCE_2027])

_SEEDED_MONTHS = {(date.fromisoformat(d).year, date.fromisoformat(d).month) for d in NFP_2026 + NFP_2027}


def coverage_warning(today: date, days_ahead: int = 0) -> str | None:
    """Non-None once the window [today, today+days_ahead] runs past the seeded calendar."""
    if today + timedelta(days=days_ahead) > SEED_THROUGH:
        return f"EVENT_CALENDAR_ENDS_{SEED_THROUGH.isoformat()}: FOMC/CPI/PCE not seeded past it, update ironfly/events.py"
    return None


def _nth_friday(y: int, m: int, n: int) -> date:
    c = calendar.Calendar()
    fridays = [d for d in c.itermonthdates(y, m) if d.month == m and d.weekday() == 4]
    return fridays[n - 1]


def load(path: str | None) -> list[dict]:
    ev = list(SEED)
    p = Path(path) if path else None
    if p and p.exists():
        ev += json.loads(p.read_text())
    return ev


def events_between(start: date, end: date, extra: list[dict] | None = None) -> list[dict]:
    """All events with start <= date <= end. Adds computed opex/quad-witching, and an NFP
    first-Friday fallback for any month not covered by NFP_2026 above."""
    out = []
    for e in (extra or []):
        d = date.fromisoformat(e["date"])
        if start <= d <= end:
            out.append({"date": d, "name": e["name"]})
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        d3 = _nth_friday(y, m, 3)
        if start <= d3 <= end:
            out.append({"date": d3, "name": "QUAD_WITCHING" if m in (3, 6, 9, 12) else "OPEX"})
        if (y, m) not in _SEEDED_MONTHS:
            d1 = _nth_friday(y, m, 1)
            if start <= d1 <= end:
                out.append({"date": d1, "name": "NFP(approx)"})
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return sorted(out, key=lambda e: e["date"])


def blocking_events(today: date, days_ahead: int, extra: list[dict]) -> list[dict]:
    """Events that should block a *new entry*: high-impact only (not opex)."""
    ev = events_between(today, today + timedelta(days=days_ahead), extra)
    return [e for e in ev if e["name"] not in ("OPEX",)]
