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
├── lib/lightning.ts          Lab controller: seeds, IndexedDB, funding bridge,
│       │                     regtest chain bridge
│       │  postMessage
│       ▼
├── Web Worker  public/lnlab/worker.js
│       │  drives the event loop, the chain feed and broadcasts
│       ▼
├── WASM module  public/lnlab/lnlab_bg.wasm     (built from rust/lnlab)
│   ├── Node "A"              full LDK 0.2 stack
│   ├── Node "B"              full LDK 0.2 stack
│   └── in-memory socket pair real Noise handshake between A and B
├── /api/bitcoin              same-origin Esplora proxy (blocks, fees, broadcast)
└── regtest worker            embedded chain (regtest only, see below)
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
explicit timestamps passed by JavaScript. The committed artifact is rebuilt
with `bash scripts/build-lnlab.sh` (see the commands in
[README.md](../README.md)); the glue is generated with `--target no-modules`
and appended an `export default` line so the committed `lnlab.js` loader shim
can import it from a module worker.

## Lifecycle

1. **Activate** — the toggle in the Lightning module boots the worker. The
   WASM module is fetched lazily (~3 MB compressed) on first activation only,
   then served from CacheStorage with ETag revalidation so later boots no
   longer re-download it.
2. **Seeds** — on first run the controller draws two 32-byte seeds
   (`crypto.getRandomValues`) and stores them in IndexedDB. Subsequent boots
   restore the same node identities.
3. **Restore** — the worker re-reads the persisted KV maps (channel monitors,
   channel manager) so channels survive reloads: each monitor is
   re-registered with the node's `ChainMonitor` (`watch_channel`) before the
   first tick, so payments resume over restored channels. Otherwise the nodes
   start fresh at the current Esplora tip.
4. **Peer link** — A connects to B through the in-memory socket pair and the
   Noise handshake runs for real. If the link drops, the UI offers to
   reconnect.
5. **Chain feed** — the worker polls the tip, downloads missing blocks
   (`block-height/:n`, then `block/:hash/raw` in binary) and feeds them to
   both nodes; fees come from `v1/fees/recommended` (sat/vB converted to
   sat/kwu). On Testnet4, Testnet3 and Signet, and on Regtest with an
   external Bitcoin Core node, both calls go through the `/api/bitcoin`
   proxy. On the embedded Regtest chain (no external node), the worker
   cannot reach the proxy — the chain lives in the browser's regtest worker
   — so the controller activates the **chain bridge**: the LN worker sends
   `chainBridgeRequest` messages, the controller resolves them against the
   regtest worker (tip, block by height, raw blocks, fees, broadcasts) and
   replies with `chainBridgeReply`. The bridge accepts only the four Esplora
   paths the lab needs (`LN_CHAIN_BRIDGE_PATH_RX` in `lib/lightning.ts`) plus
   raw-transaction broadcast (`tx`, validated by `LN_CHAIN_BRIDGE_TX_RX`);
   everything else is refused. A source-level contract test
   (`tests/lightning-funding.test.ts`) pins the field names shared by the
   worker and the host so the two sides can never drift apart again.
6. **Deactivate** — the worker flushes pending KV writes, encodes the channel
   managers and terminates. Memory returns to the browser.

### Activation persistence

Activation is an intent, not a page-scoped state. Turning the toggle on
records the network in a `lnlab-desired-nets` entry (localStorage); a global
restorer (`LnLabRestorer`) mounts on every page and re-activates the lab
right after a reload, before the user even opens the Lightning module — the
nodes then restore their channels from IndexedDB as described above. The
only way to stop the lab is the toggle itself (or a lab reset); reloading,
navigating between modules or switching the sidebar network never tears the
nodes down. When the lab runs on another network, the toggle is disabled
with an explanatory hint instead of silently stopping the running nodes.

## Channel and payment workflow

1. Open a channel from A: choose a capacity and an optional `push_msat`
   (the amount granted to B at open).
2. LDK emits a funding request; the UI turns it into a payable P2WSH address
   (`scriptToAddress`) and selects UTXOs from any of your wallets with a
   vsize-aware fee estimate before building and signing locally — the
   transaction is broadcast through the proxy and handed back to LDK via
   `funding_transaction_generated`. A discarded or refused request clears the
   pending-funding state on both sides, so a stale payment can never fund an
   abandoned channel.
3. The channel appears as *pending* with a confirmation counter (6 blocks);
   on the embedded Regtest chain the confirmation blocks are mined
   automatically right after the broadcast.
4. Once ready, create a BOLT-11 invoice on the payee node, copy or scan it,
   pay it from the payer node, and watch the HTLC settle; reverse the
   direction with `push_msat` funds.

### Payment flow rules

Both payment panels follow the same discipline, learned from the way Polar
shapes its Lightning flows:

- **The payer is chosen first.** A node picker sits at the top of the pay
  card and shows each node's live outbound liquidity; a node with zero
  outbound capacity cannot be selected as a payer.
- **Nothing is paid blind.** BOLT-11 invoices are decoded client-side
  (`bolt11` library) and the card shows the description, the amount (or
  *free amount*), the expiry and the recovered destination pubkey before the
  pay button unlocks; BOLT-12 offers are decoded by LDK on demand (*Verify*).
- **Self-payment is refused** when the decoded destination equals the payer
  node id, with an explicit explanation instead of an opaque LDK error.
- **The HTLC ceiling is enforced up front.** LDK caps a single HTLC at 10 %
  of a channel's capacity (`max_htlc_value_in_flight_percent_of_channel`);
  payments above `maxPayableSats()` are blocked with an explanation instead
  of failing after six routing retries, and invoice creation warns when no
  channel of the payee could ever settle the requested amount.
- **Payment initiation is acknowledged.** `payInvoice`/`payOffer` are
  request/response calls: an LDK rejection surfaces immediately as a toast
  with the node's own error, not as a buried journal line.

## Short channel ID (scid)

Once a channel is ready, the UI derives its **canonical BOLT-03 short channel
id** from the funding transaction placement on chain:

```
scid = (block_height << 40) | (tx_index << 16) | funding_output_index
```

- the funding outpoint (`txid:vout`) is reported by the WASM channel details;
- the block height and the transaction index inside that block come from the
  blockchain view: Esplora `tx/:txid` (`status.block_height` +
  `status.block_index`) on hosted networks, the embedded chain's own adapter
  on Regtest (`lib/regtest-engine/esplora-router.ts`);
- `lib/bitcoin/scid.ts` performs the encoding with strict range checks
  (24-bit height, 24-bit index, 16-bit output) and renders the `h x t x v`
  form shown on each ready channel card.

The derivation is pure, offline and covered by unit tests plus a Lightning
E2E scenario that reconciles the scid with the actual block record
(`tests/lightning-e2e.test.ts`). It is also the proof value captured for a
BitQuest mission of kind `CHANNEL` (`lastScid` in the mission store).

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
- Mainnet is not offered for the lab: Lightning is restricted to Regtest,
  Testnet4, Testnet3 and Signet so that protocol experiments never risk real
  funds.
