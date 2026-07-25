#!/usr/bin/env python3
"""Release gate for NeverSplit's market-research.json."""

import json
import math
import sys
from collections import Counter
from fractions import Fraction

FAILURES = []

GOLDEN = {
    "WMT": {"factor": Fraction(6144), "ipoPrice": 16.5, "splitCount": 12},
    "MCD": {"factor": Fraction(729), "ipoPrice": 22.5, "splitCount": 12},
    "NVDA": {"factor": Fraction(480), "ipoPrice": 12.0},
    "AAPL": {"factor": Fraction(224), "ipoPrice": 22.0},
    "MSFT": {"factor": Fraction(288), "ipoPrice": 21.0},
    "AMZN": {"factor": Fraction(240), "ipoPrice": 18.0},
    "TSLA": {"factor": Fraction(15), "ipoPrice": 17.0},
    "GOOGL": {"factor": Fraction(40), "ipoPrice": 85.0},
    "BKNG": {"factor": Fraction(25, 6)},
    "PH": {"factor": Fraction(81, 16)},
    "IBM": {
        "factor": Fraction(11879782031031644, 1000000000000),
        "state": "issuer-verified",
        "precision": "exact",
        "history": "issuer-complete",
    },
    "KO": {
        "factor": Fraction(9216),
        "state": "issuer-verified",
        "history": "issuer-complete",
    },
    "AMAT": {"factor": Fraction(288), "ipoPrice": 10.0},
    "JNJ": {"factor": Fraction(250047, 100), "state": "issuer-verified"},
    "HD": {"factor": Fraction(10935, 32), "state": "issuer-verified"},
}

HISTORY_TRISTATE = {
    "issuer-complete": False,
    "bounded": False,
    "truncated": True,
    "unknown": None,
    "no-events-found": False,
}


def fail(message):
    FAILURES.append(message)


def close(left, right):
    return math.isclose(float(left), float(right), rel_tol=1e-10, abs_tol=1e-9)


def event_product(events):
    result = Fraction(1)
    for event in events:
        result *= Fraction(int(event["numerator"]), int(event["denominator"]))
    return result


def validate(path):
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    rows = payload["securities"]
    meta = payload["meta"]
    quality = payload["quality"]
    by_symbol = {row["symbol"]: row for row in rows}

    if len(rows) != meta["constituentCount"]:
        fail(f"row count {len(rows)} != meta.constituentCount")
    if len(by_symbol) != len(rows):
        fail("duplicate symbols present")

    history_counts = Counter()
    confidence_counts = Counter()
    precision_counts = Counter()
    no_split_symbols = set()

    for row in rows:
        symbol = row["symbol"]
        events = row.get("splitEvents") or []
        factor = row.get("factor")
        state = row.get("factorState")
        precision = row.get("factorPrecision")
        coverage = row.get("historyCoverage")
        listing_date = (row.get("listingEvent") or {}).get("eventDate")

        if row.get("currency") != "USD":
            fail(f"{symbol}: currency must be USD")
        if row.get("splitCount") is not None and row["splitCount"] != len(events):
            fail(f"{symbol}: splitCount does not match event count")
        if coverage not in HISTORY_TRISTATE:
            fail(f"{symbol}: invalid historyCoverage {coverage}")
        elif row.get("historyTruncated") is not HISTORY_TRISTATE[coverage]:
            fail(f"{symbol}: historyTruncated disagrees with {coverage}")

        history_counts[coverage] += 1
        confidence_counts[row["confidenceLabel"]] += 1
        precision_counts[precision] += 1

        if coverage == "unknown" and (not events or listing_date is not None):
            fail(f"{symbol}: unknown history must have events and no listing date")
        if coverage in {"bounded", "truncated"} and (not events or not listing_date):
            fail(f"{symbol}: {coverage} history must have events and a listing date")
        if coverage == "no-events-found" and events:
            fail(f"{symbol}: no-events-found row contains events")
        if coverage == "issuer-complete" and state != "issuer-verified":
            fail(f"{symbol}: issuer-complete row is not issuer-verified")

        if factor is None:
            if state != "lineage-not-comparable":
                fail(f"{symbol}: null factor has state {state}")
        elif factor <= 0:
            fail(f"{symbol}: factor must be positive")

        fraction = row.get("factorFraction")
        if precision == "exact" and factor is not None and not fraction:
            fail(f"{symbol}: exact factor has no factorFraction")
        if fraction and factor is not None:
            parsed = Fraction(int(fraction["numerator"]), int(fraction["denominator"]))
            if not close(parsed, factor):
                fail(f"{symbol}: factorFraction disagrees with factor")

        if events and precision == "exact" and factor is not None and not row.get("basket"):
            if not close(event_product(events), factor):
                fail(f"{symbol}: exact factor disagrees with event product")

        if state == "issuer-verified":
            selected = [
                candidate
                for candidate in row.get("factorCandidates", [])
                if candidate.get("selected")
            ]
            if len(selected) != 1 or selected[0].get("id") != "issuer":
                fail(f"{symbol}: issuer-verified row must select exactly one issuer candidate")
            elif factor is not None and not close(selected[0].get("factor"), factor):
                fail(f"{symbol}: selected issuer candidate disagrees with factor")

        if state == "conflict-dataset-selected":
            if row.get("confidenceLabel") != "Review" or precision != "reported":
                fail(f"{symbol}: dataset-selected conflict is not Review/reported")

        ipo_state = row.get("ipoState")
        if ipo_state == "offering-sourced" and not (row.get("ipoPrice") or 0) > 0:
            fail(f"{symbol}: offering-sourced row has no positive IPO price")
        if ipo_state == "not-comparable" and row.get("ipoPrice") is not None:
            fail(f"{symbol}: not-comparable row has an IPO price")
        if state == "no-split-found":
            no_split_symbols.add(symbol)

    expected_meta = {
        "exactFactorCoverage": precision_counts["exact"],
        "reportedFactorCoverage": precision_counts["reported"],
        "noSplitFoundCount": len(no_split_symbols),
        "historyTruncatedCount": history_counts["truncated"],
        "historyCoverageUnknownCount": history_counts["unknown"],
        "highConfidenceCoverage": confidence_counts["High"],
        "mediumConfidenceCoverage": confidence_counts["Medium"],
        "lowConfidenceCoverage": confidence_counts["Low"],
        "reviewConfidenceCoverage": confidence_counts["Review"],
    }
    for key, expected in expected_meta.items():
        if key not in meta or meta[key] != expected:
            fail(f"meta.{key}={meta.get(key)} but counted {expected}")

    parity_checks = [
        ("truncatedHistories", {r["symbol"] for r in rows if r["historyCoverage"] == "truncated"}),
        ("unknownHistoryCoverage", {r["symbol"] for r in rows if r["historyCoverage"] == "unknown"}),
        ("noSplitFound", no_split_symbols),
    ]
    for key, expected in parity_checks:
        actual = {
            item if isinstance(item, str) else item["symbol"]
            for item in quality.get(key, [])
        }
        if actual != expected:
            fail(f"quality.{key} symbol set does not match row states")

    for symbol, expected in GOLDEN.items():
        row = by_symbol.get(symbol)
        if not row:
            fail(f"golden {symbol}: missing")
            continue
        if "factor" in expected and not close(expected["factor"], row.get("factor") or 0):
            fail(f"golden {symbol}: factor changed to {row.get('factor')}")
        if "ipoPrice" in expected and row.get("ipoPrice") != expected["ipoPrice"]:
            fail(f"golden {symbol}: IPO price changed to {row.get('ipoPrice')}")
        if "splitCount" in expected and row.get("splitCount") != expected["splitCount"]:
            fail(f"golden {symbol}: split count changed")
        if "state" in expected and row.get("factorState") != expected["state"]:
            fail(f"golden {symbol}: factor state changed")
        if "precision" in expected and row.get("factorPrecision") != expected["precision"]:
            fail(f"golden {symbol}: precision changed")
        if "history" in expected and row.get("historyCoverage") != expected["history"]:
            fail(f"golden {symbol}: history coverage changed")

    print(
        f"checked {len(rows)} rows: {len(FAILURES)} failures, "
        f"{history_counts['unknown']} explicitly unknown histories"
    )
    for message in FAILURES:
        print("  FAIL:", message)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "public/market-research.json"
    sys.exit(validate(target))
