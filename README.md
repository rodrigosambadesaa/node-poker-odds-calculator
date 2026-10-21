# ♠️♥️ Poker Odds Calculator ♣️♦️

[![CI](https://github.com/rodrigosambadesaa/node-poker-odds-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/rodrigosambadesaa/node-poker-odds-calculator/actions/workflows/ci.yml)
[![Latest Stable Version](https://img.shields.io/npm/v/poker-odds-calculator)](https://www.npmjs.com/package/poker-odds-calculator)

> An easy-to-use pre-flop & post-flop odds calculator for Texas Hold'em and Short Deck Hold'em (6+)

## ✨ Features

- ♠️ Texas Hold’em and Short Deck Hold’em support
- ⚡ Fast odds calculation (CLI & API)
- 🎲 Calculate equity for any number of hands
- 🧑‍💻 Node.js & TypeScript ready
- 🧪 Automated validation, multi-player scenario tests and GitHub Actions checks

## 📦 Installation

```bash
npm install poker-odds-calculator
```

## 🖥️ CLI Usage

### Pre-Flop Odds

Let's say we want to know the odds for these 3 hands: J♥J♠ vs T♦T♠ vs A♣K♣:

```bash
npx poker-odds-calculator JhJs TdTs AcKc
```

#### Post-Flop Odds

On a 7♦9♦T♠ board (with 2 cards to come), with two hands:

```bash
npx poker-odds-calculator -b 7d9dTs JhJs JdQd
npx poker-odds-calculator --board 7d9dTs7s JhJs JdQd
```
> -b denotes the board

#### Short Deck

To calculate odds using the short deck (6+) rules, override the game variant with -g/--game:

 ```bash
npx poker-odds-calculator -g short -b 7d9dTs JhJs JdQd
npx poker-odds-calculator --game short --board 7d9dTs7s JhJs JdQd
```

## 🛠️ API Usage

Calculate odds programmatically in TypeScript/Node:

```js
import {CardGroup, OddsCalculator} from 'poker-odds-calculator';

const player1Cards = CardGroup.fromString('JhJs');
const player2Cards = CardGroup.fromString('JdQd');
const board = CardGroup.fromString('7d9dTs');

const result = OddsCalculator.calculate([player1Cards, player2Cards], board);

console.log(`Player #1 - ${player1Cards} - ${result.equities[0].getEquity()}%`);
console.log(`Player #2 - ${player2Cards} - ${result.equities[1].getEquity()}%`);
```

For Short Deck odds:

```js
const result = OddsCalculator.calculate([player1Cards, player2Cards], board, 'short');
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🛡️ Security and calculation limits

This repository is a **synchronous Node.js library and CLI**, not an HTTP service.
Applications exposing it over HTTP must also implement authentication (where
appropriate), request-size limits, rate limiting, and execution isolation.
Never pass untrusted user input straight to a long-running synchronous function
on a shared web server event loop.

- Each player must provide exactly two unique, valid cards.
- Known boards must contain 0, 3 (flop), 4 (turn) or 5 (river) cards.
- Supports 2–23 fully specified players in standard Hold'em, 2–15 in Short Deck.
  These are **mathematical deck limits**, not customary casino table limits.
- Preflop uses Monte Carlo, capped at 250,000 iterations per invocation.
  The default remains 100,000; choose a smaller value on request-facing systems.
- Flop and turn enumerate all available boards exactly; river is a single outcome.
- Duplicate or impossible cards and unsupported variants are rejected.

`getEquity()` returns the rounded **outright win percentage** (ties excluded),
while `getTiePercentage()` reports how often the player is involved in a tie.
`getPotEquity()` returns the **expected share of the pot**, including split pots,
to two decimal places. Pot equities sum to approximately 100% (rounding aside).

```js
const odds = OddsCalculator.calculate(
  [CardGroup.fromString('AsAh'), CardGroup.fromString('KsKh')],
  undefined, 'full', 10000
);
console.log(odds.equities.map(player => player.getPotEquity()));
```

Use `--iterations 10000` in the CLI to cap preflop simulation work.

CI validates input boundaries, popular starting hands, multiway outcomes across
all four streets, TypeScript compilation, linting, and production npm advisories.
