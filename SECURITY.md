# Security policy

## Supported environments

Use a currently supported Node.js LTS version (the package requires Node.js 22+).
Install from a reviewed lockfile with `npm ci` and keep dependencies patched.

## Threat model and hard limits

This code is a **library and CLI**, not an HTTP API. It performs synchronous,
CPU-intensive poker hand evaluations. The public calculator checks the number
of players, board size, card validity, uniqueness and simulation budget.

Do not call it directly with arbitrary Internet-facing requests in the Node.js
event loop. If you build a web service around it, apply independent input-size
limits, authentication/rate limits when appropriate, per-job timeouts, a worker
thread or isolated process and a bounded concurrent job queue. Reject jobs that
exceed your service's budget. Avoid exposing request details in diagnostic logs.

- Texas Hold'em: 2–23 hands with 2 cards each.
- Short Deck: 2–15 hands with 2 cards each, ranks 6 through A.
- Known community cards: 0, 3, 4 or 5.
- Monte Carlo preflop: at most 250,000 iterations; default 100,000.
- Flop/turn: exhaustive enumeration; river: deterministic.

The cap limits per-call work, **not aggregate resource use across concurrent
requests**. For web deployment, asynchronous job isolation is still required.

## Dependency and CI posture

The GitHub Actions workflow runs the build, static linting, functional and
security regression tests, CLI smoke tests and production dependency audit.
Dependabot proposes updates for npm and GitHub Actions.
Workflow write access is deliberately not requested.

## Reporting vulnerabilities

Report vulnerabilities privately to the repository owner, using GitHub's
private vulnerability reporting where enabled. Do not include exploitation
details or sensitive information in public issues.
