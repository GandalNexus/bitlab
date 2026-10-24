# BitLab

**A hands-on Bitcoin & Lightning laboratory — from key to block.**

BitLab is a teaching sandbox where you can generate real wallets, build and sign real transactions, run a real Lightning node (LDK), and explore the mempool — across Mainnet, Testnet3, Testnet4, Signet and your own local Regtest chain. Private keys are derived, stored and used **exclusively in your browser**.

[![CI](https://github.com/GandalNexus/bitlab/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)


## Features

- **Wallets** — generate Legacy (P2PKH), SegWit (P2WPKH) and Taproot (P2TR) wallets from BIP39 mnemonics (12/24 words), or import existing keys via WIF. All key material stays in IndexedDB, on your machine.
- **Transaction builder** — UTXO selection, sat/vB fee slider with live mempool fee estimates, change management, local signing and broadcast. Includes raw-hex decoder and 2-of-N P2WSH multisig address creation.
- **Real Lightning Network** — two genuine LDK nodes compiled to WebAssembly and running **in your browser** (Web Worker): on-chain funded channels, BOLT11 invoices signed for real, BOLT12 offers with encrypted onion messages, Noise handshakes, real HTLC payments. No simulation, no server-side Lightning.
- **Real testnet4 & regtest miner** — when public faucets are behind captchas or accounts, mine your own test sats for real: a SHA-256d engine (WASM + JS fallback) sweeps nonces in your browser. On Testnet4 it targets BIP 94 minimum-difficulty windows and broadcasts blocks over a minimal Bitcoin P2P handshake (50 tBTC per block, 100-confirm maturity). On Regtest the whole chain is yours: difficulty 1, instant blocks handed straight to your local Bitcoin Core node — the ultimate faucet.
- **Multi-network** — Mainnet, Testnet3, Testnet4 and Signet through the public [mempool.space](https://mempool.space) Esplora APIs. Wallets are network-tagged and cross-network operations are blocked by design.
- **Explorer** — live mempool stats, recent blocks, address/UTXO lookups, raw transaction decoder.
- **Bilingual UI** — full French/English toggle, localized number/date formats, dark & light themes.

## Security model (zero-knowledge lab)

- Private keys and mnemonics **never leave the browser** — there is no key-related API endpoint.
- The server only proxies *public* blockchain data through `/api/bitcoin`, with a strict regex allow-list (anti-injection) and a 60 s cache.
- Mainnet is flagged everywhere a real-funds operation is possible.
- The Lightning lab keeps its node seeds and channel state in the browser's IndexedDB only; nothing is ever uploaded.

Found a vulnerability? Please do **not** open a public issue — see [SECURITY.md](./SECURITY.md).

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.2 (Node 20+ also works for the Next.js part).

```bash
bun install
bun run dev        # http://localhost:3000
```

Optional quality gates:

```bash
bun run lint       # ESLint
bun run typecheck  # tsc --noEmit
bun run test       # Vitest — offline Bitcoin core tests
```

### Lightning lab (browser-side)

The Lightning module ships a small Rust crate (`rust/lnlab`) that wires two full LDK 0.2 nodes and compiles them to WebAssembly. The build artifact is committed under `public/lnlab/` and loaded lazily by a Web Worker when you switch the lab on — the server never runs Lightning. Rebuild it with:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
cd rust/lnlab
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ../../public/lnlab/ \
  target/wasm32-unknown-unknown/release/lnlab.wasm
```

> Lightning runs on **Testnet4** (default), **Testnet3**, **Signet** or **Regtest**. Get testnet sats from the faucets listed in the Wallet module — mine them yourself with the built-in miner (below) — then open a channel from node A (funded by one of your wallets) and pay real invoices and offers between the two nodes. On Regtest, fund your wallet by mining, then open a channel: the full BOLT11/BOLT12 loop runs on your private chain in minutes.

### Testnet4 miner (browser-side)

Like the Lightning lab, the miner engine is a small Rust crate (`rust/miner`) compiled to WebAssembly, committed under `public/miner/` and loaded lazily by a Web Worker only while mining (a pure-JS SHA-256d fallback kicks in if WASM fails). It exploits the BIP 94 rule: a block arriving more than 20 minutes after the previous one makes the next block mineable at minimum difficulty (`nBits = 0x1d00ffff`). Found blocks are broadcast through `/api/mine/submit`, which performs a minimal version/verack handshake with public testnet4 nodes. Rebuild the engine with:

```bash
bash scripts/build-miner.sh
node scripts/check-miner-wasm.mjs   # self-test + genesis cross-check
```

### Regtest (your own private chain)

Regtest has no public explorer — BitLab talks directly to **your** Bitcoin Core node. Start it with the REST interface enabled:

```bash
bitcoind -regtest -rest=1 -rpcuser=<user> -rpcpassword=<pass>
```

Then pick **Regtest** in the network selector and fill in the node card (Wallet → Faucet panel). The `/api/bitcoin` proxy transparently translates the Esplora paths your lab already uses into Bitcoin Core REST calls, and uses two tightly-scoped RPCs (`scantxoutset` for balances, `sendrawtransaction` for broadcasts). Targets are restricted to loopback/LAN hosts — the server never contacts a public endpoint with your credentials.

What you get on Regtest:

- **Instant mining faucet** — the miner sweeps nonces at difficulty 1 and blocks mature after 100 confirmations (`generatetoaddress` works too).
- **The full Lightning loop** — mine, fund a channel, then pay BOLT11 invoices and BOLT12 offers between the two LDK nodes, all on your private chain.
- **P2P block submission** — mined blocks go to your node's P2P port (default `127.0.0.1:18444`, override with `BITLAB_REGTEST_P2P_HOST` / `BITLAB_REGTEST_P2P_PORT`).

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/bitcoin/        # Proxy Esplora — regex allow-list, 60 s cache
│   ├── api/bitcoin/        # Esplora proxy (whitelist + tx broadcast + raw blocks)
│   ├── guide/              # Developer documentation (/guide)
│   └── page.tsx            # Lab shell (sidebar + header + modules)
├── components/
│   ├── bitlab/             # Feature modules (dashboard, wallet, tx-builder…)
│   └── ui/                 # shadcn/ui primitives (kept subset)
├── hooks/                  # Shared React hooks (use-toast)
└── lib/
    ├── bitcoin/            # Domain: keys, tx building/signing/decoding
    ├── networks.ts         # Network registry (single source of truth)
    ├── mempool.ts          # Blockchain API client (facade)
    ├── lightning.ts        # Lightning lab controller (worker bridge)
    ├── store.ts            # Zustand + IndexedDB persistence
    ├── i18n.tsx            # French/English dictionary-based i18n
    └── theme.tsx           # Dark/light theme (no-flash boot)
```


Key design decisions:

- **Layered** — pure domain logic (`lib/bitcoin`) has zero React dependencies and is fully unit-tested.
- **Config-driven networks** — adding a network means adding one entry to `NETWORKS`.
- **Late binding** — the `networks.ts` / `store.ts` circular dependency is broken via `registerNetGetter`.
- **Browser-only crypto** — signing happens client-side with audited `@scure/*` + `@noble/*` libraries.

## Documentation

Full documentation for developers and new contributors lives in
[docs/index.md](./docs/index.md):

- [Getting started](./docs/getting-started.md) — first lab session, end to end
- [Architecture](./docs/architecture.md) — layers, patterns and data flows
- [Wallets and keys](./docs/wallet-and-keys.md), [Transactions](./docs/transactions.md), [Lightning](./docs/lightning.md), [Networks](./docs/networks.md) — module references
- [Security model](./docs/security-model.md), [Testing and CI](./docs/testing-and-ci.md), [Troubleshooting](./docs/troubleshooting.md), [Glossary](./docs/glossary.md)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow, commit conventions and project rules. By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

> French issues and PRs are welcome — the project is francophone-first, the UI ships in both French and English.

## License

[MIT](./LICENSE) © GandalNexus
