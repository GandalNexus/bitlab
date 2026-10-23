# Contributing to BitLab

Thank you for considering a contribution! BitLab is an educational project — clarity, honesty (no mocked blockchain data) and safety (no key material server-side) are non-negotiable.

## Getting started

```bash
git clone https://github.com/GandalNexus/bitlab.git
cd bitlab
bun install
bun run dev          # http://localhost:3000
```

New to the codebase? Start with [docs/index.md](./docs/index.md) — it maps the
whole documentation set, including the
[architecture overview](./docs/architecture.md) and the
[testing guide](./docs/testing-and-ci.md).

Before opening a PR, make sure all four quality gates pass:

```bash
bun run lint         # ESLint — 0 errors expected (warnings: non-null assertions tolerated)
bun run typecheck    # tsc --noEmit — must be clean
bun run test         # Vitest — all tests must pass
bun run build        # Next.js production build — must succeed
```

## Project rules

1. **Never mock blockchain data.** If a real API cannot be reached, show the real error. Simulated data is a bug, not a fallback.
2. **Private keys stay in the browser.** Never add an endpoint that could receive key material, mnemonics or WIF strings. `lib/bitcoin/*` must remain server-free.
3. **Add networks via `lib/networks.ts`.** The `NETWORKS` registry is the single source of truth — no network-specific `if` scattered in components.
4. **User-facing strings go through `t()`** (see `lib/i18n.tsx`). The FR phrase is the key; add its EN counterpart to `lib/i18n-dict.ts`.
5. **Domain logic is pure TypeScript.** `lib/bitcoin/*` must not import React; keep it testable offline.
6. **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `ci:`.

## Commit & branch conventions

```
<type>(<scope>): <short summary in imperative mood>

feat(wallet): add Taproot import from xprv
fix(tx-builder): reset UTXO selection when wallet changes
```

- Branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Keep PRs focused: one feature or one fix per PR.
- Update `tests/bitcoin.test.ts` when you touch `src/lib/bitcoin/*`.

## Issues, labels and good first issues

Open a [bug report](https://github.com/GandalNexus/bitlab/issues/new?template=bug_report.yml)
or a [feature request](https://github.com/GandalNexus/bitlab/issues/new?template=feature_request.yml)
— the forms pre-fill the context a maintainer needs (network, module,
private-window check). Questions go to
[Discussions](https://github.com/GandalNexus/bitlab/discussions); blank
issues are disabled on purpose.

**Looking for a first contribution?** Browse the issues labeled
[`good first issue`](https://github.com/GandalNexus/bitlab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
Each one is scoped for a newcomer: a single surface, pointers to the exact
files, and explicit acceptance criteria. Comment on the issue to claim it
before you start, and keep the pull request focused on that one change.
First-time contributors get an automatic welcome message on their first
issue and pull request.

**The label system** (maintained automatically — do not create labels by
hand; the registry lives in [.github/labels.yml](./.github/labels.yml)):

| Group | Labels |
| --- | --- |
| Nature of the work | `bug`, `enhancement`, `documentation`, `performance`, `security`, `ux`, `question`, `ci` |
| Who should pick it up | `good first issue`, `help wanted` |
| Triage state | `needs-triage` (auto on new issues), `needs-review`, `blocked`, `stale` (bot) |
| Priority | `priority: high`, `priority: medium`, `priority: low` |
| Areas (auto on PRs) | `area: wallet`, `area: lightning`, `area: tx-builder`, `area: explorer`, `area: i18n`, `area: server`, `area: wasm`, `tests` |

Pull requests are labeled automatically from the files they touch, and the
PR title must follow Conventional Commits (enforced by CI). The `stale` bot
never touches `good first issue` or `help wanted` issues — the newcomer pool
stays fresh on purpose.

**Security issues:** please do **not** open a public issue. See [SECURITY.md](./SECURITY.md) for the private disclosure process.

## Code style

- TypeScript strict; no `any` unless justified (lint warns).
- Components under ~300 lines — split when they grow.
- French JSDoc comments are the current house style; English comments are equally welcome.

## Local tips

- State persists in IndexedDB — "weird" wallet lists are usually stale local state; test in a private window.
- The Lightning lab logs into the UI journal; LDK traces are visible per node while the lab is active.
