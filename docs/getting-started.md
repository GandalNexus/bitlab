# Getting Started

This tutorial walks you from a fresh clone to a complete laboratory session:
creating a wallet, obtaining test coins, building and broadcasting a
transaction, and observing the result. It takes roughly fifteen minutes.

## Requirements

| Tool | Version | Used for |
| --- | --- | --- |
| [Bun](https://bun.sh) | 1.2 or later | Dependency management, dev server, scripts |
| Node.js | 20 or later (optional) | Runs the Next.js part if you prefer npm |
| Rust | stable (optional) | Only to rebuild the Lightning WASM artifact |

The core lab (wallets, transactions, explorer) has no external service
requirement beyond internet access to the public `mempool.space` Esplora APIs.

## Installation

```bash
git clone https://github.com/GandalNexus/bitlab.git
cd bitlab
bun install
```

There are no environment variables to configure and nothing to install beyond
Bun: the Lightning module ships as a compiled WebAssembly artifact served from
`public/lnlab/`, and every other feature works out of the box.

## Running the lab

```bash
bun run dev
```

Open `http://localhost:3000`. The interface ships in French and English; the
language toggle is in the header, and the dark and light themes are switched
from the same place.

Three quality gates are available locally and are expected to pass at all
times:

```bash
bun run lint       # ESLint
bun run typecheck  # tsc --noEmit
bun run test       # Vitest, offline suite
```

## A tour of the interface

The application is a single-page lab with a sidebar giving access to five
modules and the guide:

- **Dashboard** — live overview of the active network: recommended fees,
  mempool congestion, recent blocks.
- **Wallet** — wallet generation and import, balances, UTXO list, faucet
  shortcuts.
- **Transactions** — the transaction builder: UTXO selection, fee slider,
  outputs, signing, broadcasting, plus the raw transaction decoder and the
  multisig workshop.
- **Lightning** — two real LDK nodes: on-chain funding, peer connection,
  channel opening, invoice creation and payment.
- **Explorer** — mempool statistics, recent transactions, address and
  transaction lookups.
- **Guide** — the in-application user manual for the workflow above.

## Your first session

The following sequence is the recommended learning path. Perform it on
Testnet4, the default network, where coins have no value.

**Step 1 — Generate a wallet.** Open the Wallet module, choose an address
type (start with SegWit), and generate a wallet. BitLab derives it from a
BIP-39 mnemonic and displays the address, the public key and the WIF. Write
the mnemonic down if you want to re-import the wallet later; it is also shown
in the wallet details.

**Step 2 — Obtain test coins.** With the wallet active, copy its address from
the faucet card and request coins on one of the listed external faucets.
Wait for the transaction to confirm; the balance and UTXO list refresh
automatically through the Esplora proxy.

**Step 3 — Build a transaction.** Open the Transactions module, select the
UTXO you just received, add an output to a second address (generate a second
wallet to hold it), pick a fee rate from the live mempool estimates, and click
build. BitLab signs locally and shows the fee, the virtual size and the change
amount before anything leaves the machine.

**Step 4 — Broadcast.** Send the signed transaction through the proxy and
watch it move from the mempool view to a confirmed state in the Explorer.

**Step 5 — Experiment.** Decode the raw hex of your transaction to inspect its
inputs, outputs and witness. Create a 2-of-3 multisig address from three
public keys. When you are ready, move to the Lightning module and follow the
channel lifecycle described in [Lightning](./lightning.md).

## The Lightning lab (in your browser)

The Lightning module is fully client-side: a toggle in the module boots a Web
Worker that lazily fetches the WebAssembly build of `rust/lnlab` (~3 MB
compressed, on first activation only) and runs two real LDK nodes inside your
tab. The server never runs Lightning, so there is nothing to install, no
daemon to babysit and no host memory cost — deactivating the toggle frees
everything. Lightning requires Testnet3 or Signet (LDK has no Testnet4
network). See [Lightning](./lightning.md) for the full lifecycle, and
[README.md](../README.md) for the optional rebuild commands.

## Production build

```bash
bun run build     # builds and assembles .next/standalone
bun run start     # serves the standalone build on port 3000
```

The build produces a standalone output that embeds the compiled client assets,
including the Lightning WebAssembly artifact. See
[Architecture](./architecture.md) for what the server does and, more
importantly, what it never does.

## Next steps

- Understand the design: [Architecture](./architecture.md).
- Learn the vocabulary: [Glossary](./glossary.md).
- Contribute: [CONTRIBUTING.md](../CONTRIBUTING.md).
