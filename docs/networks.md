# Networks and Connectivity

BitLab operates on five Bitcoin networks — four public ones and one local. This document explains the network
registry that drives the whole application, the Esplora proxy that carries
every blockchain read and write, and the rules that keep networks isolated
from one another.

## The network registry

`src/lib/networks.ts` declares one `NetConfig` entry per network. Every part
of the application — the selector, derivation paths, explorer links, faucet
cards, mainnet warnings — reads from this single source of truth. No
component is allowed to branch on a network id directly; if you find yourself
writing `if (net === 'testnet3')` in a component, move that knowledge into
the registry instead.

| Property | Meaning |
| --- | --- |
| `id`, `label` | Stable identifier and display name |
| `apiBase` | mempool.space Esplora base path used by the proxy |
| `explorer` | Public explorer base for outbound links |
| `realFunds` | True for mainnet; drives every real-value warning |
| `coinType` | BIP-44/84/86 coin type: `0` mainnet, `1` test networks |
| `addressHint`, `wifHint` | Format hints shown in forms |
| `faucets`, `faucetNote` | Curated faucet list for the funding workflow |

## Supported networks

| Network | Coin type | Default | Real funds | Mining | Lightning |
| --- | --- | --- | --- | --- | --- |
| Testnet4 | 1 | Yes (default) | No | Yes — BIP 94 min-diff windows | No (LDK lacks Testnet4) |
| Testnet3 | 1 | No | No | No | Yes |
| Signet | 1 | No | No | No (signed blocks) | Yes |
| Regtest | 1 | No | No | Yes — difficulty 1, local node | Yes |
| Mainnet | 0 | No | Yes | No, by design | No, by design |

The default network is Testnet4 so that a fresh installation can never
accidentally touch real value. Mainnet is listed last in the selector and
flagged in every context where a real-funds action is possible.

## Adding a network

Because the registry is data-driven, adding a network is a small, contained
change:

1. Add a `NetConfig` entry to `NETWORKS` in `src/lib/networks.ts` and extend
   the `NetId` union.
2. If `@scure/btc-signer` knows the network, extend `signerNetwork()` so
   address derivation and signing use the right parameters; otherwise the
   test-network parameters are the correct adapter point.
3. Add the upstream to `UPSTREAMS` and, if needed, the allowed paths to the
   proxy allow-list in `src/app/api/bitcoin/route.ts`.
4. Add the French UI strings and their English counterparts to
   `src/lib/i18n-dict.ts`.
5. Extend the offline tests if the network changes derivation or address
   behavior.

If the change is done right, no component or module outside `networks.ts`,
the proxy route and the dictionary needs editing. That is the point of the
registry pattern.

## Local networks: Regtest

Regtest has no public Esplora API — it lives on the user's machine. The
registry entry carries `local: true` and an empty `explorer`, and the proxy
`/api/bitcoin` gains an adapter instead of an upstream: Esplora-shaped paths
are translated to Bitcoin Core REST calls (node started with `-regtest -rest=1`,
port 18443 shared with RPC). The translation table lives in
`src/lib/bitcoin/regtest-translate.ts` and is fully unit-tested.

| Esplora path | Core backend |
| --- | --- |
| `blocks/tip/height`, `blocks/tip/hash` | `/rest/chaininfo.json` |
| `block/{hash}/header` | `/rest/headers/1/{hash}.json` |
| `block/{hash}/raw` | `/rest/block/{hash}.bin` (binary passthrough) |
| `block-height/{n}` | `/rest/blockhashbyheight/{n}.json` |
| `tx/{txid}`, `tx/{txid}/hex` | `/rest/tx/{txid}.json` / `.hex` |
| `address/{a}`, `address/{a}/utxo` | RPC `scantxoutset` (`addr()` descriptor) |
| `address/{a}/txs` | empty list (no `-txindex` on a fresh lab node) |
| `v1/fees/recommended` | static 1 sat/vB (no fee market) |
| `mempool`, `mempool/recent` | `/rest/mempool/info.json` / `contents.json` |
| `v1/blocks` | chaininfo + block walk via `previousblockhash` |
| `POST tx` | RPC `sendrawtransaction` |

Connection details (host, RPC port, `rpcuser`/`rpcpass`) are entered in the
node settings card (Wallet module), persisted in the browser's localStorage
and sent to the proxy through the `X-Regtest-Cfg` header — never in URLs.
The server re-validates every target host against loopback/private ranges
before connecting, so the adapter can never be aimed at a public endpoint.

Known limits (by design, documented in the adapter): `tx` status is reported
as confirmed (regtest blocks are near-instant), address history is empty and
mempool `value` is 0 — none of these affect balances, mining or Lightning.

Mining on Regtest reuses the Testnet4 engine with a local profile: no BIP 94
windows (difficulty 1, continuous), nBits copied from the tip header, and
found blocks are relayed through `/api/mine/submit` to the node's P2P port
(`127.0.0.1:18444`, overridable via `BITLAB_REGTEST_P2P_HOST`/`_PORT`).

## The Esplora proxy

All blockchain data flows through `GET/POST /api/bitcoin`. The route exists
to (a) avoid CORS and rate-limit friction, (b) enforce a strict input
contract, and (c) cache short-lived reads.

**Path allow-list.** Only these read paths may pass, after a sanitizer strips
every character outside `[a-zA-Z0-9/_-]`:

```
v1/fees/recommended          blocks/tip/height
v1/blocks  v1/blocks/<n>     mempool  mempool/recent
address/<addr>  address/<addr>/utxo  address/<addr>/txs
tx/<txid>  tx/<txid>/hex
v1/lightning/statistics/latest
```

Anything else returns 400. The `network` query parameter selects the upstream
and defaults to Testnet4 if absent or unknown.

**Caching.** Successful GETs are cached for 60 seconds keyed by network and
path. The cache is capped at 300 entries; when the cap is hit, expired
entries are purged first and the oldest entries are evicted next. This keeps
the server's memory flat even after hours of address exploration.

**Broadcast.** `POST` is accepted only for `path=tx`. The body must be
hexadecimal of at least 120 characters; the route relays it to the active
network with a 15-second timeout and returns the node's answer verbatim —
the txid, or the refusal reason.

## Network isolation

Wallets are tagged with the network they were derived for
(`LabWallet.network`), and the active network lives in the store. The UI
enforces three invariants:

1. A wallet derived on one network cannot send to or receive on another.
2. Address and WIF validation use the active network's parameters, so a
   mainnet WIF cannot be imported while Testnet4 is active.
3. Mainnet displays a real-funds warning at every dangerous step:
   generation, funding, transaction building and broadcasting.

These invariants are implemented in selectors and the domain layer rather
than scattered through components, which makes them hard to bypass by
accident. See [Architecture](./architecture.md) for how the layers enforce
this.

## Faucets

The registry curates faucet links per test network, each annotated with what
it requires (`none`, `captcha` or `account`). The Wallet module shows the
list for the active network with the active wallet's address ready to copy.
Mainnet has no faucets, by construction.

| Network | Notable faucets |
| --- | --- |
| Testnet4 | mempool.space faucet (account), faucet.testnet4.dev (captcha), testnet4.info, CoinFaucet.eu |
| Testnet3 | CoinFaucet.eu, bitcoinfaucet.uo1.net |
| Signet | signetfaucet.com, alt.signetfaucet.com, Hiro faucet API |
| Regtest | none — you are the faucet: mine from the browser or `bitcoin-cli -regtest generatetoaddress` |

Faucet availability changes over time; treat the list as a maintained
recommendation, and update it in the registry rather than in the UI.

## Related documentation

- How the proxy relates to the security posture:
  [Security model](./security-model.md).
- Derivation paths per network: [Wallets and keys](./wallet-and-keys.md).
- Broadcasting details: [Transactions](./transactions.md).
