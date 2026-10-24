# Architecture

BitLab is a Next.js 16 single-page laboratory backed by a small Python
in-browser Lightning lab. This document explains how the codebase is organized, which design
patterns it relies on, and why. The guiding constraints are: private key
material never reaches the server, blockchain data is never mocked, and the
domain logic must stay testable offline.

## High-level view

```
Browser (all cryptography happens here)
├── app/                    Next.js App Router
│   ├── page.tsx            Lab shell: sidebar, header, active module
│   ├── guide/              In-application user guide
│   └── api/                Server routes (proxies only, see below)
│       ├── bitcoin/        Esplora proxy: allow-list, 60 s cache
│       └── bitcoin/        Esplora proxy: regex whitelist, cache, tx broadcast
├── components/
│   ├── bitlab/             Feature modules (dashboard, wallet, tx-builder…)
│   └── ui/                 shadcn/ui primitives (kept subset)
├── hooks/                  Shared React hooks
└── lib/
    ├── bitcoin/            Pure domain logic: keys, transactions, utils
    ├── networks.ts         Network registry (single source of truth)
    ├── mempool.ts          Blockchain API client (facade over the proxy)
    ├── lightning.ts        Lightning lab controller (worker bridge, IndexedDB)
    ├── store.ts            Zustand store, IndexedDB persistence
    ├── i18n.tsx            Dictionary-based FR/EN internationalization
    └── theme.tsx           Dark/light theme with no-flash boot

Host machine (optional, started on demand)
└── public/lnlab/           WASM artifact: two real LDK nodes + worker
    └── rust/lnlab/          Rust crate wiring LDK 0.2 (source of the artifact)
```

## The layer model

The codebase follows a strict inward dependency rule: components may import
from `lib`, `lib` never imports from `components`, and the domain layer
`lib/bitcoin` imports neither React nor any browser-only API beyond WebCrypto
primitives.

| Layer | Location | Responsibility | May depend on |
| --- | --- | --- | --- |
| Domain | `src/lib/bitcoin/*` | Key derivation, transaction construction, signing, decoding | Audited crypto libraries only |
| State | `src/lib/store.ts` | Wallets, active network, dev logs; IndexedDB persistence | Domain |
| Connectivity | `src/lib/mempool.ts`, `src/lib/lightning.ts` | Esplora client and Lightning lab controller | State, Domain |
| Presentation | `src/components/*` | Feature modules and UI primitives | All of the above |
| Server | `src/app/api/*` | Two narrow proxies with strict input filtering | Node stdlib only |

The practical consequence: the entire Bitcoin domain is pure TypeScript. It
runs in Vitest with no browser, no network and no mocks, which is what the
offline test suite in `tests/bitcoin.test.ts` relies on.

## Server routes are proxies, nothing more

The Next.js server holds no state and no secrets. It exposes exactly two
routes:

1. `GET/POST /api/bitcoin` relays public blockchain reads and raw transaction
   broadcasts to the mempool.space Esplora APIs. A regex allow-list decides
   which paths may pass; a bounded 60-second cache reduces load on the public
   nodes. See [Networks](./networks.md).
2. The Lightning lab never touches a server-side process: the UI posts
   messages to a Web Worker that drives the WebAssembly LDK nodes, and chain
   data flows through the same `/api/bitcoin` proxy. See [Lightning](./lightning.md).

There is deliberately no endpoint that could receive key material, mnemonics
or WIF strings. This is the core of the
[security model](./security-model.md).

## Design patterns in use

The project applies a small number of well-known patterns. Knowing them makes
the codebase predictable.

| Pattern | Where | What it solves |
| --- | --- | --- |
| Registry | `lib/networks.ts` | Networks are data (`NETWORKS: Record<NetId, NetConfig>`), not `if` statements scattered in components. Adding a network is adding one entry. |
| Late binding | `networks.ts` + `store.ts` | The store registers a getter via `registerNetGetter()`, breaking the `networks` to `store` cycle without lazy-import tricks. |
| Facade | `lib/mempool.ts`, `lib/lightning.ts` | Components call `api.fees()` or `lnLab.openChannel(...)` instead of building URLs, messages or raw responses. |
| Proxy with allow-list | `app/api/bitcoin/route.ts` | Only explicitly allow-listed Esplora paths reach the upstream; everything else is rejected with 400. |
| Repository | `lib/store.ts` | Persistence is a single `persist(snap(state))` seam over `idb-keyval`, swappable without touching actions. |
| Strategy | `lib/bitcoin/tx.ts`, `keys.ts` | Address type dispatch (`legacy` / `segwit` / `taproot`) is expressed as data tables and per-type branches, not string checks across the UI. |
| Adapter | `lib/networks.ts` | `signerNetwork()` maps a `NetId` onto `@scure/btc-signer` network parameters, isolating the third-party shape. |
| Provider | `lib/i18n.tsx`, `lib/theme.tsx` | Language and theme are React contexts with a no-flash boot script in `layout.tsx`. |

## State management and persistence

`useLabStore` (Zustand) holds wallets, the active wallet id, the active
network and a bounded dev log (250 entries). Persistence is explicit: each
mutating action snapshots the relevant slice into IndexedDB under the key
`bitlab-lab-state-v1` through `idb-keyval`. Hydration happens once at boot
(`hydrate()`), and a stale or missing database degrades gracefully to an
in-memory session.

Wallet records are network-tagged (`LabWallet.network`), and the UI blocks
cross-network operations: an address derived for testnet4 cannot receive a
transaction drafted on signet. This invariant is enforced in selectors, not
in components, so it cannot be bypassed by forgetting a check.

## Internationalization

The French sentence is the translation key. `t()` and `tSync()` look up the
English counterpart in `lib/i18n-dict.ts`; a missing entry falls back to the
French key rather than crashing. Placeholders use braces:
`t('Diffusion refusée par le nœud {net}', { net })`. New user-facing strings
must go through `t()`; this is a documented project rule in
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Technology stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16, App Router, React 19 | Turbopack in dev and build |
| Language | TypeScript 5, strict | `tsc --noEmit` is a CI gate |
| Styling | Tailwind CSS 4 | Design tokens in `globals.css`, dark mode included |
| UI primitives | shadcn/ui on Radix | Curated subset in `src/components/ui` |
| State | Zustand 5 | Explicit persistence, no middleware magic |
| Server state | TanStack Query | Fetch caching and retry for blockchain reads |
| Crypto | `@scure/btc-signer`, `@scure/bip32`, `@scure/bip39`, `@noble/curves` | Audited, dependency-light, browser-first |
| Lightning | `ldk-node` 0.7 (Python bindings) | Two real nodes per supported network |
| Tests | Vitest 3 | Offline, deterministic |
| CI | GitHub Actions | Lint, typecheck, tests, production build |

## Memory and resource profile

The lab is designed to stay light on the host machine:

- The production server is a standalone Next.js process with a flat memory
  profile (about 110 MB RSS measured on a cold start).
- The Esplora cache is capped at 300 entries with expiry-first eviction, so
  browsing many addresses cannot grow the process indefinitely.
- The Lightning lab costs the server nothing: the WASM module is a static
  file loaded on demand by the visitor's browser. Activating the lab consumes
  memory in the browser tab only; deactivating it terminates the worker and
  frees everything. Event buffers are capped (60 per node) and the chain feed
  polls the proxy at a gentle 10-second interval.
- Dependencies are pruned deliberately; the package currently declares 24
  runtime dependencies.

## Where to read next

- Module references: [Wallets and keys](./wallet-and-keys.md),
  [Transactions](./transactions.md), [Lightning](./lightning.md),
  [Networks](./networks.md).
- The rules behind the code: [Security model](./security-model.md).
- Contribution workflow: [CONTRIBUTING.md](../CONTRIBUTING.md).
