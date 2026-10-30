# Testing and CI

BitLab's test suite proves that its Bitcoin core works, offline, without a
browser and without any network. This document explains what is covered, how
to write tests that fit the suite, and how the four quality gates run
locally and in CI.

## Philosophy

Three principles shape the suite:

1. **Offline and deterministic.** The domain layer (`src/lib/bitcoin/*`) is
   pure TypeScript, so the tests exercise real cryptography — real secp256k1
   keys, real BIP-39 seeds, real signatures — with zero network access and
   zero mocks. Determinism means failures are reproducible and meaningful.
2. **Round-trips over snapshots.** The strongest assertions in a crypto code
   base are round-trips: encode then decode, build then sign then parse, and
   require that the ends meet. The suite favors them over brittle string
   snapshots.
3. **Honest edge cases.** Spending more than you have, dust outputs, invalid
   WIFs and wrong-network keys are not exotic: they are the mistakes the lab
   exists to teach about. The suite pins their behavior.

## What the suite covers

`tests/bitcoin.test.ts` runs 17 tests in 8 groups:

| Group | Coverage |
| --- | --- |
| Wallet generation | One wallet per address type (legacy, SegWit, Taproot): address shape, 24-word mnemonic, derivable keys |
| WIF import | Round-trip: same key and address; cross-type address difference for the same key |
| Mnemonic import | Determinism: same phrase, same address |
| Scripts and addresses | Every standard script type reconstructs its address |
| Build and sign | A signed, parseable transaction for each input type |
| Edge cases | Outputs exceeding inputs are rejected; dust amounts are rejected |
| Multisig | A 2-of-3 P2WSH address and valid witness script |
| Fee estimation | Realistic virtual-size ranges for SegWit 2-input and Taproot 1-input transactions |

The suite runs entirely against the default network resolution: no store is
registered in the test environment, so `currentNet()` falls back to Testnet4
and every derivation path, address encoding and signature is pinned to the
test-network coin type.

## Running and writing tests

```bash
bun run test        
bun run test:watch  
```

Configuration lives in `vitest.config.ts` (node environment,
`tests/**/*.test.ts`). Conventions for new tests:

- Keep them offline. If a test needs the network, it belongs in a manual
  script under `scripts/`, not in the suite.
- One behavior per test, named after the behavior, not the function.
- When you touch `src/lib/bitcoin/*`, extend the suite in the same pull
  request; this is a stated rule in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Do not weaken an assertion to make a change pass. If the expected behavior
  changed, say so in the pull request description.

## The four quality gates

Every change is expected to keep all four gates green:

```bash
bun run lint       
bun run typecheck  
bun run test       
bun run build      
```

### Lint rules worth knowing

The ESLint configuration (`eslint.config.mjs`) builds on
`eslint-config-next` (core-web-vitals plus TypeScript) and adds project
rules:

| Rule | Setting | Rationale |
| --- | --- | --- |
| `prefer-const`, `no-var` | error | Modern baseline |
| `eqeqeq` | error, smart | No loose equality surprises |
| `no-console` | warn, `warn`/`error` allowed | Server routes may log; components should not |
| `@typescript-eslint/no-unused-vars` | error | Underscore-prefixed names are exempt |
| `@typescript-eslint/no-explicit-any` | warn | `any` must be justified in review |
| `@typescript-eslint/no-non-null-assertion` | warn | Tolerated where derivation guarantees non-null; keep it rare |
| `react-hooks/exhaustive-deps` | warn | Effect dependencies are reviewed, not silenced |

The current baseline is zero errors and a handful of tolerated warnings in
`keys.ts`, `tx.ts` and `tx-builder.tsx`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request targeting
`main`. The four gates run as **parallel jobs** — a lint failure does not
hide a build failure, and each gate gets its own check in the pull request
interface:

```yaml
jobs:
  lint:       # ESLint — bun run lint
  typecheck:  # tsc --noEmit — bun run typecheck
  test:       # Vitest — bun run test (100 % hors-ligne, WASM Lightning inclus)
  build:      # Next.js production build — bun run build
  pr-title:   # Conventional Commits check on the pull request title
```

Two extra guards frame the gates:

- **Concurrency** — a new push to the same branch cancels the superseded
  run instead of queueing it;
- **PR title check** — the title must be a Conventional Commit
  (`feat(wallet): …`), matching the rule stated in
  [CONTRIBUTING.md](../CONTRIBUTING.md).

### The full workflow set

The CI workflow is the entry point of a small automation stack, the kind
mature open source projects run:

| Workflow | Trigger | Role |
| --- | --- | --- |
| `ci.yml` | push / PR on `main` | Four parallel quality gates + docs links + PR title |
| `codeql.yml` | push / PR on `main`, weekly schedule | GitHub CodeQL security analysis (`security-extended`) |
| `audit.yml` | weekly, lockfile change, manual | `bun audit` against `bun.lock` |
| `labeler.yml` | pull request | Auto-labels PRs from changed paths (`.github/labeler.yml`) |
| `labels.yml` | registry change, manual | Syncs the canonical label set from `.github/labels.yml` |
| `first-interaction.yml` | first issue / first PR | Welcomes first-time contributors (bilingual) |
| `stale.yml` | daily schedule | Flags quiet issues/PRs — exempts `good first issue`, `help wanted` and `security` |

Notes for contributors:

- The Lightning lab's Rust/WASM build is not exercised in CI: the artifact is
  committed under `public/lnlab/`, the offline suite covers the typed
  controller, and the full peer flow needs a real chain sync, so it is
  reviewed manually.
- The production build step exists precisely because builds fail in ways
  typechecks do not catch (route configuration, standalone assembly,
  static-generation errors).
- A red CI on your branch means the pull request is not reviewable yet; fix
  forward rather than merging around it.

## Related documentation

- The modules under test: [Wallets and keys](./wallet-and-keys.md),
  [Transactions](./transactions.md).
- The rules the tests protect: [Security model](./security-model.md).
