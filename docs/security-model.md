# Security Model

BitLab is a teaching tool, but its security posture is not pedagogical: it is
a set of hard rules enforced by the architecture. This document states the
model, the threats it addresses, and the boundaries it deliberately does not
claim. For the private disclosure process, see
[SECURITY.md](../SECURITY.md).

## The zero-knowledge lab protocol

The defining property of BitLab: **private key material never leaves the
browser.**

- Wallets are generated, derived and signed using audited browser-side
  libraries (`@scure/*`, `@noble/*`).
- Persistence is the browser's IndexedDB, under the key
  `bitlab-lab-state-v1`. There is no account, no sync, no backup endpoint.
- The server exposes no route that could receive a private key, a mnemonic, a
  WIF string or a signature request tied to key material. Not "it is
  protected": the endpoints simply do not exist.

A student can therefore experiment on mainnet with the same confidence as on
testnet: the worst a compromised server could do is serve wrong blockchain
data, which the UI attributes to its sources, or refuse to relay a
transaction. It can never steal a key it never received.

## What the server actually does

The Next.js server has exactly one responsibility: a public-data proxy.

1. `/api/bitcoin` — reads from mempool.space Esplora behind a regex
   allow-list, with a 60-second bounded cache; relays raw binary blocks for
   the Lightning lab's chain feed; broadcasts raw transactions that the
   client already signed.
2. On Regtest, the same route acts as a translating adapter to the user's
   own Bitcoin Core (REST + two scoped RPCs: `scantxoutset`,
   `sendrawtransaction`). Node coordinates travel in the `X-Regtest-Cfg`
   header (never in URLs), and every target host is re-validated server-side
   against loopback/private ranges — the adapter cannot be aimed at a public
   endpoint, which caps the SSRF surface by construction. Credentials live in
   the browser's localStorage and are only ever forwarded to the node the
   user themselves configured.
3. `/api/mine/submit` — relays browser-mined blocks over a minimal P2P
   handshake: public Testnet4 seeds on Testnet4, the user's local node only
   (no peer discovery, loopback by default) on Regtest.

It holds no sessions, no secrets, no database, and runs no Lightning
process. In production it runs as a standalone Node process with
`poweredByHeader` disabled.

## Threat model

| Threat | Mitigation |
| --- | --- |
| Malicious or compromised server steals keys | Structurally impossible: no key material is ever transmitted. The proxy allow-list cannot be extended to accept it. |
| Injection through the proxy (path traversal, SSRF to internal services) | Strict allow-list of full paths; sanitizer strips every character outside `[a-zA-Z0-9/_-]`; network selection is a closed enum, not user text. |
| Broadcast abuse (server used as a free relay) | POST accepts only `path=tx` with a well-shaped hexadecimal payload; the node's own policies still apply upstream. |
| Accidental mainnet loss | Mainnet is flagged at every dangerous step; default network is Testnet4; the transaction builder shows fee, size and change before signing. |
| Lightning lab exposure | The lab runs entirely in the browser: seeds and channel state stay in the origin's IndexedDB, the worker talks only to the same-origin proxy, and the server holds nothing that could be leaked. |
| Cross-network mistakes | Wallets are network-tagged; address and WIF validation use active-network parameters; cross-network operations are blocked by design. |
| XSS leading to key theft | Keys live in memory and IndexedDB of the app origin only; no third-party scripts; strict React escaping; no `dangerouslySetInnerHTML` in user-data paths. |

## Lightning-specific considerations

The browser holds real node seeds for test networks. The rules:

- Seeds, channel monitors and channel managers live exclusively in the
  origin's IndexedDB and are never transmitted; the server has no route that
  could receive them.
- The two lab nodes communicate over an in-memory socket pair, so no
  Lightning traffic ever touches the network or the host's ports.
- Test networks only. The lab's network enum (`testnet3`, `signet`) has no
  mainnet entry, so a misconfiguration cannot point real value at a teaching
  tool.

## What this model does not claim

Honesty about limits is part of the model:

- A compromised browser extension or a compromised host can read IndexedDB.
  BitLab is a lab; treat anything stored in it as expendable and use the
  mnemonic to restore wallets in a serious wallet when value matters.
- The public Esplora nodes are trusted for data correctness. The UI surfaces
  errors instead of inventing data, but it does not independently verify
  block headers.
- The tool does not aim to be a wallet for savings. Nothing about its UX
  suggests otherwise, and the mainnet warnings exist to keep it that way.

## Rules for contributors

The architectural rules in [CONTRIBUTING.md](../CONTRIBUTING.md) are the
security model expressed as code review criteria:

1. Never add an endpoint that could receive key material.
2. Never mock blockchain data; show the real error.
3. Keep `src/lib/bitcoin/` server-free and React-free.
4. Route all network configuration through the registry.
5. Route all user-facing strings through `t()`.

If a change weakens any of these, it needs an explicit design discussion
with the maintainer, not a quick fix. Security-relevant findings go through
[SECURITY.md](../SECURITY.md), never through a public issue.
