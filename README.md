<div align="center">
  <a href="https://github.com/GandalNexus/bitlab">
    <img src="public/icon-dark.svg" alt="BitLab" width="140" />
  </a>

  <h1>BitLab</h1>
  <p><strong>A hands-on Bitcoin &amp; Lightning laboratory — from key to block.</strong></p>

  <p>
    <a href="https://github.com/GandalNexus/bitlab/actions/workflows/ci.yml">
      <img alt="CI" src="https://github.com/GandalNexus/bitlab/actions/workflows/ci.yml/badge.svg" />
    </a>
    <a href="./LICENSE">
      <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
    </a>
  </p>
</div>

BitLab is a teaching sandbox where you can generate real wallets, build and sign real transactions, run a real Lightning node (LDK), and explore the mempool — across Mainnet, Testnet3, Testnet4, Signet and your own local Regtest chain. Private keys are derived, stored and used **exclusively in your browser**.

## Features

- **Wallets** — generate Legacy (P2PKH), SegWit (P2WPKH) and Taproot (P2TR) wallets from BIP39 mnemonics (12/24 words), or import existing keys via WIF. All key material stays in IndexedDB, on your machine.
- **Transaction builder** — UTXO selection, sat/vB fee slider with live mempool fee estimates, change management, local signing and broadcast. Includes raw-hex decoder and 2-of-N P2WSH multisig address creation.
- **Real Lightning Network** — two genuine LDK 0.2 nodes compiled to WebAssembly and running **in your browser** (Web Worker): on-chain funded channels, BOLT11 invoices signed for real, BOLT12 offers with encrypted onion messages, Noise handshakes, real HTLC payments. No simulation, no server-side Lightning. Best experienced on **Regtest** (instant confirmations) or Testnet4.
- **Real testnet4 & regtest miner** — mine your own test sats directly in the browser: a SHA-256d engine (WASM + JS fallback) sweeps nonces. On Testnet4 it targets BIP 94 minimum-difficulty windows and broadcasts blocks over a minimal Bitcoin P2P handshake. On Regtest the whole chain is yours: difficulty 1, instant blocks, 50 tBTC per block.
- **Embedded Regtest chain** — no Bitcoin Core required for Regtest. BitLab ships a full in-process chain engine (PoW validation, mempool, BIP 34, maturity, faucet) persisted to `.bitlab/regtest-chain.json`. Connect an external node only if you need it.
- **Multi-network** — Mainnet, Testnet3, Testnet4 and Signet through the public [mempool.space](https://mempool.space) Esplora APIs. Wallets are network-tagged and cross-network operations are blocked by design.
- **Explorer** — live mempool stats, recent blocks, address/UTXO lookups, raw transaction decoder.
- **Bilingual UI** — full French/English toggle, localized number/date formats, dark & light themes.

## Security model

- Private keys and mnemonics **never leave the browser** — there is no key-related API endpoint.
- The server only proxies *public* blockchain data through `/api/bitcoin`, with a strict regex allow-list (anti-injection) and a 60 s in-memory cache.
- Mainnet is flagged everywhere a real-funds operation is possible.
- Lightning node seeds and channel state live in the browser's IndexedDB only; nothing is ever uploaded.

Found a vulnerability? Please do **not** open a public issue — see [SECURITY.md](./SECURITY.md).

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.2 (Node 20+ also works).

```bash
bun install
bun run dev        # http://localhost:3000
```

Quality gates:

```bash
bun run lint          # ESLint
bun run typecheck     # tsc --noEmit
bun run format:check  # Prettier
bun run test          # Vitest — 155 offline tests (Bitcoin core, scid, BitQuest bridge, Lightning e2e)
```

## Lightning lab — regtest workflow

The recommended path to try Lightning end-to-end:

1. Select **Regtest** in the network selector.
2. Go to **Wallet** → generate a SegWit wallet → use the **Faucet** to fund it (the embedded chain mines to your address automatically).
3. Go to **Lightning** → activate the lab → click **Open channel**, pick your wallet as the funding source.
4. The UI builds and signs the funding transaction, broadcasts it, mines 8 confirmation blocks, and waits for `channel_ready` — all automatically. The ready channel then displays its canonical BOLT-03 short channel ID (`h x t x v`), derived from the funding output placement on the embedded chain.
5. Create a **BOLT11 invoice** on node B and pay it from node A. Create a **BOLT12 offer** on node B and pay it from node A.

No external node, no faucet, no waiting. The full BOLT11/BOLT12 loop runs in under a minute on the embedded chain. On Regtest the Lightning worker pulls blocks and broadcasts through the embedded chain worker itself (chain bridge), so the lab needs nothing beyond the browser.

> On **Testnet4** / **Signet** funding confirmation depends on real-network block times (~10 min). Fund the lab wallet from an external testnet faucet and wait for 6 on-chain confirmations before the channel becomes usable.

## WASM modules

Both performance-critical engines are written in Rust and compiled to WebAssembly. The build artifacts are committed under `public/` so no Rust toolchain is needed to run the app. Each loader shim embeds a **content hash** of the binary so browsers always fetch the latest WASM after a rebuild (no stale-cache issues).

### Lightning (lnlab)

`rust/lnlab` — two real LDK 0.2 nodes (Noise handshake, real HTLCs, BOLT12 onion messages) compiled to WASM. Loaded lazily by a Web Worker when the Lightning module is activated; the server never touches Lightning state.

```bash
bash scripts/build-lnlab.sh
```

Requires: `rustup target add wasm32-unknown-unknown` and `wasm-bindgen-cli 0.2.100`.

### Miner (miner)

`rust/miner` — dependency-free SHA-256d engine with midstate optimisation. Falls back to a pure-JS implementation if WASM is unavailable.

```bash
bash scripts/build-miner.sh
node scripts/check-miner-wasm.mjs   # self-test + genesis cross-check
```

## Regtest — external Bitcoin Core node (optional)

By default Regtest runs entirely in-process (no installation required). To connect your own Bitcoin Core node instead:

```bash
bitcoind -regtest -rest=1 -rpcuser=<user> -rpcpassword=<pass>
```

Then pick **Regtest** in the network selector and fill in the node card (Wallet → Settings). The `/api/bitcoin` proxy translates Esplora paths to Bitcoin Core REST calls and two tightly-scoped RPCs (`scantxoutset`, `sendrawtransaction`). Connections are restricted to loopback/LAN — the server never contacts a public endpoint with your credentials.

Environment overrides for P2P block submission: `BITLAB_REGTEST_P2P_HOST` / `BITLAB_REGTEST_P2P_PORT` (defaults: `127.0.0.1:18444`).

## Architecture

```
src/
├── app/
│   ├── api/bitcoin/        # Esplora proxy (path whitelist + embedded regtest engine)
│   ├── api/regtest/        # Embedded chain: faucet, mine, info, reset
│   ├── api/mine/submit     # P2P block broadcast (testnet4 + regtest)
│   ├── guide/              # Developer documentation (/guide)
│   └── page.tsx            # Lab shell (sidebar + header + modules)
├── components/
│   ├── bitlab/             # Feature modules (dashboard, wallet, tx-builder, lightning…)
│   └── ui/                 # shadcn/ui primitives
└── lib/
    ├── bitcoin/            # Domain: keys, tx build/sign/decode (zero React deps, fully tested)
    ├── mining/             # Miner controller + core (block assembly, BIP 94 windows)
    ├── regtest-engine/     # Embedded chain (PoW, mempool, BIP 34, maturity, Esplora adapter)
    ├── networks.ts         # Network registry (single source of truth)
    ├── mempool.ts          # Blockchain API client
    ├── lightning.ts        # Lightning controller (worker bridge + KV persistence)
    ├── store.ts            # Zustand + IndexedDB persistence
    ├── i18n.tsx            # FR/EN dictionary-based i18n
    └── theme.tsx           # Dark/light theme (no-flash boot)

public/
├── lnlab/                  # Committed WASM + loader shim (lnlab.js, lnlab_bg.js/wasm)
└── miner/                  # Committed WASM + loader shim (miner.js, miner_bg.js/wasm)

rust/
├── lnlab/                  # LDK two-node Lightning crate → public/lnlab/
└── miner/                  # SHA-256d miner crate → public/miner/
```

Key design decisions:

- **Browser-only crypto** — signing happens client-side with audited `@scure/*` + `@noble/*` libraries.
- **Layered** — `lib/bitcoin` and `lib/regtest-engine` have zero React dependencies and are fully unit-tested.
- **Config-driven networks** — adding a network means adding one entry to `NETWORKS`.
- **Content-hash WASM loading** — each build script stamps a 12-char SHA-256 of the binary into the loader shim, busting the browser cache on every rebuild without server-side headers.
- **Late binding** — the `networks.ts` / `store.ts` circular dependency is broken via `registerNetGetter`.

## Testing

```bash
bun run test
```

155 tests across 11 suites:

| Suite | What it covers |
|---|---|
| `bitcoin.test.ts` | Wallet generation (Legacy/SegWit/Taproot), WIF/mnemonic import, tx build/sign/decode, multisig, fee estimation |
| `scid.test.ts` | Canonical BOLT-03 short channel id: encoding bounds, `h x t x v` formatting, outpoint parsing, Esplora status derivation |
| `mining.test.ts` | BIP 34, `compactBitsToTarget`, `blockSubsidy`, `assembleHeader76`, `headerMeetsTarget`, `windowStatus`, JS fallback engine |
| `regtest.test.ts` | Embedded chain: genesis, PoW, faucet, confirmations, Esplora adapter |
| `engine-hot-reload.test.ts` | Server-side chain singleton hot-reload detection |
| `tx-spend.test.ts` | Full spend cycle (UTXO → sign → broadcast → mine → confirm) on the embedded chain, plus `block_index` placement exposed to the scid resolver |
| `lightning-e2e.test.ts` | Real LDK WASM: boot → Noise handshake → open channel → fund → 6-conf `channel_ready` → canonical scid reconciliation → BOLT11 pay/claim → BOLT12 offer pay/claim → cooperative close → `boot_restore` |
| `lightning-funding.test.ts` | `classifyBroadcast` — duplicate funding tx treated as success; chain-bridge allow-list and activation rules |
| `bitquest-bridge.test.ts` | Deep-link parsing, return-URL building, proof validation per kind |
| `bitquest-mission-store.test.ts` | Mission store persistence (sessionStorage), proof selection per kind |
| `wallet-balance-refresh.test.ts` | Regtest wallet balance derivation from the UTXO set |

The Lightning e2e suite drives the committed WASM binary directly (no mocks, no network).

## Documentation

Full documentation lives in [docs/index.md](./docs/index.md):

- [Getting started](./docs/getting-started.md) — first lab session, end to end
- [Architecture](./docs/architecture.md) — layers, patterns and data flows
- [Wallets and keys](./docs/wallet-and-keys.md), [Transactions](./docs/transactions.md), [Lightning](./docs/lightning.md), [Networks](./docs/networks.md)
- [Security model](./docs/security-model.md), [Testing and CI](./docs/testing-and-ci.md), [Troubleshooting](./docs/troubleshooting.md), [Glossary](./docs/glossary.md)

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow, commit conventions and project rules. By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

> French issues and PRs are welcome — the project is francophone-first, the UI ships in both French and English.

## License

[MIT](./LICENSE) © GandalNexus
