---
title: Reading the volatility regime
summary: IV rank, the variance risk premium, term structure, vol of vol, skew, and vol trend — what each tells a premium seller.
order: 2
tags: volatility, VIX, skew
---

Selling premium is only worth it when the premium is fair or rich and the volatility regime is
stable. A handful of public measures cover most of that judgment.

## Is premium rich? IV rank and IV percentile

Both compare today's VIX with its own past year.

- **IV rank** = (VIX − 1-year low) ÷ (1-year high − 1-year low). One spike can compress it for months.
- **IV percentile** = share of the past year's days with VIX below today. More robust to spikes.

Low readings mean you are selling cheap insurance. Very high readings mean volatility is already
expanding and can keep going.

## Is implied above realized? The variance risk premium

VIX minus realized volatility over the last 20 days. Positive is the normal state and the reason
the trade works. Negative means the market is moving more than options imply; selling premium then
is selling insurance below cost.

## Is the market calm? Term structure

Compare 30-day VIX with 3-month VIX3M. Normally the curve slopes up (**contango**): near-term risk
is priced below longer-term risk. When VIX rises above VIX3M (**backwardation**), the market is
pricing stress *now*. Short-premium positions should be defended, not added.

## Is volatility itself volatile? VVIX

VVIX is the implied volatility of VIX options. Above roughly 110 the vol regime can shift fast;
above 130 it usually already is.

## How expensive is downside protection? Skew

The CBOE SKEW index measures how much more the market pays for far out-of-the-money puts than a
normal distribution would imply. Ranked against its own history:

- **Low skew** — puts are cheap. A fly's protective wing costs little, and there is little tail fear.
  Favours the iron butterfly.
- **High skew** — puts are rich. A condor's short put is well paid, and a fly overpays for its wing.
  Favours the iron condor.

## Which way is volatility heading? Vol trend

A short exponential moving average of VIX (three days is enough) separates volatility that is
**coming in** from volatility that is **expanding**. The at-the-money short straddle inside a fly
carries the most vega and gamma of anything in a premium book, so a fly wants vol below its 75th
percentile *and* falling.

## Putting it together

No single number decides. The Iron Fly & Iron Condor module scores each structure from these
inputs, applies hard vetoes for the dangerous states (backwardation, negative premium, extreme
vol of vol, scheduled macro events), and only then proposes a trade.
