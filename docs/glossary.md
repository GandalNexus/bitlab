# Glossary

Short definitions of the Bitcoin and project vocabulary used throughout this
documentation. Terms are ordered by theme. When a term is central to a
module, the entry links to the reference page that develops it.

## Bitcoin fundamentals

**Address** — A short, human-copyable string derived from a public key or
script, used to receive coins. Formats include legacy (`1…`), P2SH (`3…`),
SegWit bech32 (`bc1q…` on mainnet, `tb1q…` on testnets) and Taproot bech32m
(`bc1p…`, `tb1p…`). See [Wallets and keys](./wallet-and-keys.md).

**Block** — A batch of transactions committed to the chain roughly every ten
minutes, referencing the previous block by hash.

**Broadcast** — Submitting a signed transaction to the network so it enters
the mempool. See [Transactions](./transactions.md).

**Change** — The remainder sent back to the spender's own wallet when the
selected inputs exceed the intended payment plus fee.

**Confirmation** — The state of a transaction included in a block; each
additional block on top adds one confirmation.

**Fee rate** — The price of block space, expressed in satoshis per virtual
byte (sat/vB). Higher rates confirm sooner.

**Mempool** — The set of broadcast but unconfirmed transactions held by nodes.

**Satoshi (sat)** — The smallest bitcoin unit, one hundred millionth of a
btc. Amounts in BitLab are satoshis unless stated otherwise.

## Keys and scripts

**BIP-32** — Hierarchical deterministic wallets: derive a tree of keys from
one seed, addressed by paths such as `m/84'/1'/0'/0/0`.

**BIP-39** — Mnemonic phrases: 12 or 24 English words encoding the seed,
with a checksum. The lab's mnemonic import validates both words and
checksum.

**BIP-44 / 84 / 86** — Derivation conventions for legacy, SegWit and Taproot
wallets respectively. BitLab swaps the coin type (`0'` mainnet, `1'` test
networks) centrally. See [Wallets and keys](./wallet-and-keys.md).

**bech32 / bech32m** — Checksummed address encodings used by SegWit
(bech32) and Taproot (bech32m).

**Multisig (m-of-n)** — A script requiring m signatures among n public keys.
The lab builds native P2WSH multisig addresses. See
[Transactions](./transactions.md).

**P2PKH / P2WPKH / P2TR / P2WSH** — Pay-to-Public-Key-Hash (legacy),
Pay-to-Witness-Public-Key-Hash (native SegWit), Pay-to-Taproot, and
Pay-to-Witness-Script-Hash. The script type determines address format, size
and fee.

**Private key / public key** — The secret number and its derived point on
the secp256k1 curve. The lab keeps the private key in the browser; only
public data ever reaches the server.

**Schnorr signature** — The signature scheme Taproot uses, smaller and
composable compared to ECDSA.

**UTXO** — Unspent Transaction Output: an amount locked to a script,
spendable whole as an input of a future transaction. Balances are sums of
UTXOs.

**vsize (virtual size)** — The transaction weight metric that fee rates
multiply. SegWit inputs are much cheaper in vsize than legacy inputs. See
the table in [Transactions](./transactions.md).

**WIF** — Wallet Import Format: a base58check encoding of a private key,
network-tagged (`K…`/`L…` mainnet, `c…` testnets).

**x-only key** — The 32-byte Taproot public key form, without the parity
byte.

## Networks

**Esplora** — The block-explorer API style served by mempool.space and
proxied by BitLab's `/api/bitcoin` route. See [Networks](./networks.md).

**Mainnet** — The production Bitcoin network where btc has real value.
Flagged in BitLab at every risky step.

**Signet** — A permissioned test network with predictable blocks; supported
by LDK, hence usable in the Lightning module.

**Testnet3 / Testnet4** — Public test networks. Testnet4 is BitLab's default;
LDK does not support it, so Lightning runs on Testnet3 and Signet.

## Lightning

**BOLT-11 invoice** — The Lightning payment request string (`lntb…` on test
networks) encoding amount, payment hash and description. See
[Lightning](./lightning.md).

**Channel** — A two-party off-chain balance locked by an on-chain funding
transaction. Spendable capacity is per-direction, not shared.

**Confirmation depth** — The number of blocks a funding transaction needs
before the channel becomes usable.

**HTLC** — Hash Time-Locked Contract: the mechanism that makes a Lightning
payment atomic and routable.

**LDK** — Lightning Dev Kit, the Rust Lightning library BitLab compiles to
WebAssembly (`rust/lnlab`) and runs in the browser.

**Millisatoshi (msat)** — One thousandth of a satoshi, Lightning's native
unit. LDK reports msat; the UI converts.

**LnLab** — BitLab's in-browser Lightning lab: the `rust/lnlab` crate
(two real LDK nodes) compiled to WebAssembly and driven by a Web Worker.
It replaced the former server-side sidecar.

## Project terms

**Lab wallet** — A `LabWallet` record: address type, source
(generated / mnemonic / WIF), network tag, keys and metadata, persisted in
IndexedDB.

**Quality gates** — Lint, typecheck, tests and production build; all four
must stay green. See [Testing and CI](./testing-and-ci.md).

**Registry** — The `NETWORKS` record in `src/lib/networks.ts`, the single
source of truth for network behavior.

**Zero-knowledge lab** — The project's protocol: no key material, mnemonic or
WIF is ever transmitted to the server. See
[Security model](./security-model.md).
