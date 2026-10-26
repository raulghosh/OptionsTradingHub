---
title: Iron condors and iron butterflies, from the ground up
summary: What the two structures are, how they make and lose money, and which market each one wants.
order: 1
tags: options, iron condor, iron butterfly
---

Both trades are **defined-risk, short-premium** positions built from four options on the same
expiry. You collect a credit up front and keep it if the index stays inside a range. The long
options cap the loss if it does not.

## The structures

| | Iron butterfly | Iron condor |
|---|---|---|
| Short put | at the money | out of the money (often ~16 delta) |
| Short call | at the money, **same strike** as the put | out of the money, symmetric |
| Long put | below the body by the wing width | below the short put by the wing width |
| Long call | above the body by the wing width | above the short call by the wing width |
| Credit | large, often 30–45 % of the wing | smaller, often 20–35 % of the wing |
| Max profit | credit, only if it settles exactly at the body | credit, anywhere between the shorts |
| Max loss | wing width − credit | wing width − credit |
| Breakevens | body ± credit | short put − credit, short call + credit |

An iron butterfly is an iron condor whose short strikes have collapsed onto one strike.

## Where the money comes from

Index options are, on average, priced for more movement than actually happens. The gap between
implied and subsequently realized volatility is the **variance risk premium**. Both structures
sell it. In greek terms they are **short gamma, short vega, and long theta**: every day that the
index moves less than the options implied, time decay pays you.

They lose when the index **trends** or **gaps** through a short strike, or when implied
volatility jumps and marks the position against you before decay has had time to work.

## Which one, when

- The **fly** is a bet that the index **pins** near today's price. Its profit is a narrow tent: a lot
  of credit, but it rarely reaches more than a fraction of it before risk outweighs reward. It wants a
  quiet, mean-reverting market with volatility that is moderate and falling.
- The **condor** is a bet that **not much happens**. Its profit zone is a wide plateau, so it tolerates
  drift, at the cost of a smaller credit. It is the default when premium is reasonable but you have
  no strong view that price will stay put.

## Managing them

Experienced traders rarely hold either to expiry. The usual rules are a profit target (about half
the credit for condors, a quarter for flies), a stop at a multiple of the credit, a time exit
before the last week's gamma takes over, and a short list of adjustments when one side is tested:
roll the untested side closer for extra credit, roll out in time for a net credit, or close. The
Iron Fly & Iron Condor module on this site applies those rules mechanically.
