"""Does a GARCH volatility regime filter improve the validated setup?

GARCH forecasts the MAGNITUDE of tomorrow's move, never its direction — so it
cannot be a signal. The two things it can plausibly do here:

  1. Regime filter — are cup-forming+confluence signals better in calm markets
     than in storms? If so, that is a free filter on a setup already traded.
  2. Better stop sizing than ATR — ATR is realised and backward-looking; a
     GARCH conditional forecast reacts to volatility clustering. Whether that
     is *better* for stop placement is an empirical question, not a given.

Method mirrors milesdeutscher/garchmethod, whose walk-forward implementation I
checked line by line and which is genuinely free of lookahead. Re-implemented
here rather than imported so it runs against our own OKX candles and our own
signal dates.

NO-LOOKAHEAD DISCIPLINE, restated because it is the bug that keeps recurring in
this project: the model at day t is fitted on returns strictly BEFORE t, and
the forecast it produces is for t+1. A signal on day t is therefore judged by a
forecast that used no information from day t's outcome.

Expectancy is measured with the exit rule validated in trailingExitTest.js —
ATR*1.5 stop, no fixed target, 14-day hold — so results are comparable to the
0.949R benchmark rather than to some other exit.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from arch import arch_model

EXPORT_DIR = Path(__file__).resolve().parent.parent / "data" / "export"
# Shortened from 250 to 120. GARCH(1,1) has three parameters and converges
# acceptably on ~120 observations; the earlier 250 discarded every signal in the
# first year and halved the sample to n=54, which left the storm bucket at n=7 —
# too thin to base a live filter on. The cost of the shorter window is noisier
# early parameter estimates, which is the right trade when the alternative is
# having no usable sample at all.
MIN_TRAIN = 120
REFIT_EVERY = 25         # re-estimate params this often; roll the recursion between
REGIME_LOOKBACK = 120    # window for the volatility percentile (was 180)
HOLD_DAYS = 14
COST_PERCENT = 0.25      # round trip, the crypto convention used throughout


def walkforward_garch(closes: np.ndarray) -> np.ndarray:
    """1-day-ahead conditional vol forecast per bar. NaN until MIN_TRAIN."""
    rets = 100.0 * np.diff(closes) / closes[:-1]
    n = len(rets)
    fcast = np.full(n, np.nan)
    if n < MIN_TRAIN + 10:
        return fcast

    mu = omega = alpha = beta = None
    sigma2 = None
    for t in range(MIN_TRAIN, n):
        if (t - MIN_TRAIN) % REFIT_EVERY == 0:
            # rets[:t] excludes t — the model never sees the day it forecasts.
            am = arch_model(rets[:t], vol="GARCH", p=1, q=1, mean="Constant", dist="t")
            res = am.fit(disp="off", show_warning=False)
            p = res.params
            mu, omega, alpha, beta = p["mu"], p["omega"], p["alpha[1]"], p["beta[1]"]
            sigma2 = float(res.conditional_volatility[-1] ** 2)
        eps = rets[t] - mu
        sigma2 = omega + alpha * eps ** 2 + beta * sigma2
        fcast[t] = np.sqrt(sigma2)   # made at close of t, applies to t+1
    return fcast


def simulate(candles: pd.DataFrame, idx: int, stop_distance: float) -> float | None:
    """Validated exit: ATR*1.5 stop, no target, 14-day hold. Returns R."""
    entry = candles["c"].iloc[idx]
    stop = entry - stop_distance
    if stop_distance <= 0 or entry <= 0:
        return None
    cost_r = COST_PERCENT / ((stop_distance / entry) * 100)
    for d in range(1, HOLD_DAYS + 1):
        j = idx + d
        if j >= len(candles):
            break
        if candles["l"].iloc[j] <= stop:
            return -1.0 - cost_r
    j = min(len(candles) - 1, idx + HOLD_DAYS)
    if j <= idx:
        return None
    return (candles["c"].iloc[j] - entry) / stop_distance - cost_r


def stat(xs: list[float]) -> dict:
    a = np.asarray([x for x in xs if x is not None and np.isfinite(x)])
    if len(a) < 2:
        return {"n": len(a), "avgR": None, "t": None, "win": None}
    m = a.mean()
    se = a.std(ddof=1) / np.sqrt(len(a))
    return {
        "n": len(a),
        "avgR": round(float(m), 3),
        "t": round(float(m / se), 2) if se > 0 else None,
        "win": round(float((a > 0).mean() * 100), 1),
    }


def main() -> None:
    files = sorted(EXPORT_DIR.glob("*.json"))
    if not files:
        sys.exit("no exports found — run `node src/analysis/exportSignals.js` first")

    rows = []
    for f in files:
        data = json.loads(f.read_text())
        candles = pd.DataFrame(data["candles"])
        if len(candles) < MIN_TRAIN + 30:
            continue
        fcast = walkforward_garch(candles["c"].to_numpy(dtype=float))
        # fcast[i] is indexed on the RETURNS array, which is one shorter than
        # candles and offset by one: fcast[i] corresponds to candle i+1.
        vol = np.full(len(candles), np.nan)
        vol[1:] = fcast
        vol_s = pd.Series(vol)
        # Percentile of today's forecast against its own trailing year. Uses
        # only past values, so it stays walk-forward.
        pct = vol_s.rolling(REGIME_LOOKBACK, min_periods=90).apply(
            lambda w: (w[:-1] < w[-1]).mean() * 100 if len(w) > 1 else np.nan, raw=True)

        for sig in data["signals"]:
            i = sig["index"]
            if i >= len(candles) or not np.isfinite(vol[i]) or not np.isfinite(pct.iloc[i]):
                continue
            r_atr = simulate(candles, i, sig["stopDistance"])
            # GARCH-sized stop, same 1.5 multiplier as ATR uses. NOTE: this is
            # NOT width-normalised — GARCH stops came out materially narrower
            # (median 5.75% vs ATR 8.62% on the validated set), so any avgR
            # advantage partly reflects the tighter stop rather than a better
            # forecast. Under fixed-fractional sizing a narrower stop means a
            # bigger position for the same dollar risk, so more R is real money
            # — but it is not evidence that GARCH forecasts volatility better.
            # Normalise widths before making that claim.
            garch_stop = vol[i] / 100.0 * sig["entry"] * 1.5
            r_garch = simulate(candles, i, garch_stop)
            rows.append({
                "symbol": data["symbol"], "universe": data["universe"],
                "time": sig["time"], "pctile": float(pct.iloc[i]),
                "r_atr": r_atr, "r_garch": r_garch,
                "atr_pct": sig["stopDistance"] / sig["entry"] * 100,
                "garch_pct": garch_stop / sig["entry"] * 100,
            })
        print(f"  {data['symbol']:<12} {len(data['signals'])} signals", flush=True)

    df = pd.DataFrame(rows)
    if df.empty:
        sys.exit("no usable signals")

    for uni in ["validated", "midcap"]:
        d = df[df["universe"] == uni]
        if d.empty:
            continue
        print(f"\n{'=' * 68}\n{uni}  (n={len(d)})\n")
        print("  baseline, ATR stop      ", stat(d["r_atr"].tolist()))
        print("  same entries, GARCH stop", stat(d["r_garch"].tolist()))
        print(f"\n  median stop width: ATR {d['atr_pct'].median():.2f}%  "
              f"GARCH {d['garch_pct'].median():.2f}%")

        print("\n  --- regime filter (percentile of GARCH vol forecast) ---")
        for label, lo, hi in [("calm    (0-33)", 0, 33), ("normal (33-67)", 33, 67),
                              ("storm  (67-100)", 67, 101)]:
            sub = d[(d["pctile"] >= lo) & (d["pctile"] < hi)]
            print(f"  {label}  {stat(sub['r_atr'].tolist())}")

        calm_normal = d[d["pctile"] < 67]
        print(f"\n  skip storms (keep <67 pctile): {stat(calm_normal['r_atr'].tolist())}")
        print(f"  keep everything:               {stat(d['r_atr'].tolist())}")


if __name__ == "__main__":
    main()
