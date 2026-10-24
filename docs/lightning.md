# Lightning

BitLab's Lightning module runs two real LDK nodes, not a simulation. This
document explains the in-browser architecture, the node lifecycle, the
channel-and-payment workflow used in a lab session, how BOLT12 offers work,
and how persistence works.

## What is real here

Everything that matters is real. The two nodes hold persistent identities
(seeds stored in the browser), sync blocks from the mempool.space Esplora APIs
through the application's own proxy, speak the Lightning peer protocol, sign
real BOLT-11 invoices, exchange real BOLT-12 offers and invoices over encrypted
onion messages, and settle real HTLCs over real channels. Errors —
insufficient balance, a channel waiting on confirmations, an expired invoice —
are surfaced as-is. The project rule is explicit: no mocked blockchain data,
ever (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Architecture

```
Browser
├── React UI (components/bitlab/lightning.tsx)
│       │  messages
│       ▼
├── lib/lightning.ts          Lab controller: seeds, IndexedDB, funding bridge
│       │  postMessage
│       ▼
├── Web Worker  public/lnlab/worker.js
│       │  drives the event loop, the chain feed and broadcasts
│       ▼
├── WASM module  public/lnlab/lnlab_bg.wasm     (built from rust/lnlab)
│   ├── Node "A"              full LDK 0.2 stack
│   ├── Node "B"              full LDK 0.2 stack
│   └── in-memory socket pair real Noise handshake between A and B
└── /api/bitcoin              same-origin Esplora proxy (blocks, fees, broadcast)
```

The server never runs Lightning. It serves the compiled WebAssembly artifact
as a static file and relays public blockchain data. Activating the lab costs
nothing on the host; deactivating it terminates the worker and frees the
browser memory.

## Why WebAssembly instead of a sidecar

The previous implementation ran a Python sidecar (LDK Node bindings) on the
host. It worked, but it required Python on the server, kept two native nodes
resident in memory, and its first chain sync was fragile. Compiling LDK's Rust
core to WebAssembly removes the whole operational surface: no daemon, no ports,
no Python, no host memory. LDK's high-level wrapper (`ldk-node`) does not
support `wasm32` yet, so `rust/lnlab` performs the canonical wiring by hand
using the `lightning` crate directly:

- `KeysManager` provides entropy, node signing and channel signers;
- `ChainMonitor` persists channel monitors through a `KVStoreSync`
  implementation backed by IndexedDB;
- a custom `DirectRouter` builds the single-hop route to the counterparty
  (correct by construction for a two-node lab, and independent of gossip),
  including the one-hop blinded payment paths BOLT12 invoices embed;
- an `OnionMessenger` wired to the channel manager handles BOLT12 offers and
  onion-message routing (`LabMessageRouter` answers with a direct path — the
  only possible destination is the connected peer);
- a `PeerManager` over an in-memory `SocketDescriptor` pair connects the two
  nodes; every byte exchanged is real protocol data.

The crate is compiled with LDK's `std` feature disabled: the wasm32 target has
no wall clock (`Instant::now` traps), and the no-std paths derive time from
explicit timestamps passed by JavaScript.

## Lifecycle

1. **Activate** — the toggle in the Lightning module boots the worker. The
   WASM module is fetched lazily (~3 MB compressed) on first activation only.
2. **Seeds** — on first run the controller draws two 32-byte seeds
   (`crypto.getRandomValues`) and stores them in IndexedDB. Subsequent boots
   restore the same node identities.
3. **Restore** — the worker re-reads the persisted KV maps (channel monitors,
   channel manager) so channels survive reloads. Otherwise the nodes start
   fresh at the current Esplora tip.
4. **Peer link** — A connects to B through the in-memory socket pair and the
   Noise handshake runs for real. If the link drops, the UI offers to
   reconnect.
5. **Chain feed** — the worker polls the proxy for the tip, downloads missing
   blocks (`block-height/:n`, then `block/:hash/raw` in binary) and feeds them
   to both nodes; fees come from `v1/fees/recommended` (sat/vB converted to
   sat/kwu).
6. **Deactivate** — the worker flushes pending KV writes, encodes the channel
   managers and terminates. Memory returns to the browser.

## Channel and payment workflow

1. Open a channel from A: choose a capacity and an optional `push_msat`
   (the amount granted to B at open).
2. LDK emits a funding request; the UI turns it into a payable P2WSH address
   (`scriptToAddress`). Fund it from any of your wallets — the transaction is
   built and signed locally, then broadcast through the proxy.
3. The channel appears as *pending* with a confirmation counter (6 blocks).
4. Once ready, create a BOLT-11 invoice on B, copy or scan it, pay it from A,
   and watch the HTLC settle; reverse the direction with `push_msat` funds.

## BOLT12 offers vs BOLT11 invoices

The payments tab separates the two protocols on purpose — beginners should
never have to guess which one they are holding:

| | BOLT11 — invoice | BOLT12 — offer |
| --- | --- | --- |
| Encoding | `lntb…` / `lntbs…` | `lno1…` |
| Reuse | single use, one amount | reusable, unlimited payments |
| Amount | locked in the invoice | optional — may be free |
| Transport | pasted/scanned, paid directly | invoice requested over encrypted onion messages |
| Good for | one precise payment | a payment code (tip jar, salary, machine-to-machine) |

How a BOLT12 payment flows in the lab:

1. B creates an offer (`create_offer`): the offer embeds a one-hop **blinded
   message path** back to B — the introduction node is B itself.
2. A calls `pay_offer`: the channel manager builds an **invoice request** and
   the `OnionMessenger` routes it through the blinded path (encrypted hop by
   hop; A never appears as sender, B never reveals its channel).
3. B's channel manager verifies the request, creates a real **BOLT12 invoice**
   carrying a blinded payment path, and answers over the reply path.
4. A verifies the invoice and pays it — from here the HTLC machinery is the
   same as BOLT11: `PaymentClaimed` on B, `PaymentSent` on A.

Without a funded channel the flow fails honestly with `RouteNotFound` in the
journal — exactly the kind of real error the lab exists to show.

The offer decoder (`Vérifier` / "Verify") displays the description, the amount
(or *montant libre*) and the issuer key before any payment is attempted; a
payer note can be attached to the invoice request.

## Persistence and security

- Seeds, channel monitors and the channel manager live exclusively in the
  browser's IndexedDB; the server stores nothing.
- The Rust source (`rust/lnlab`) and the committed build artifact
  (`public/lnlab/`) can be audited and rebuilt with the commands in
  [README.md](../README.md).
- Mainnet is not offered for the lab: Lightning is restricted to Testnet4,
  Testnet3 and Signet so that protocol experiments never risk real funds.
