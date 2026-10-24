# Transactions

This document is the reference for the transaction module: how BitLab selects
inputs, estimates fees, builds, signs, decodes and broadcasts transactions.
The implementation lives in `src/lib/bitcoin/tx.ts`; the UI in
`src/components/bitlab/tx-builder.tsx`; the broadcast path in
`src/app/api/bitcoin/route.ts`.

## Transaction lifecycle

Every payment in BitLab follows the same five stages, and all of the
expensive ones happen in the browser:

1. **Select** — the module fetches the active wallet's UTXOs from the Esplora
   proxy and the user picks which ones to spend.
2. **Build** — `draftTx()` assembles an unsigned transaction from the UTXOs,
   the outputs and an optional change output.
3. **Sign** — `buildSignedTx()` computes the change from a fee estimate,
   signs with the local private key, and finalizes the transaction.
4. **Broadcast** — the raw hex is posted through `/api/bitcoin?path=tx` to
   the active network's Esplora node.
5. **Observe** — the transaction is visible in the mempool, then in a block;
   the Explorer module follows it by txid.

## Input selection and validation

Inputs are `Utxo` records (`txid`, `vout`, `value`, confirmation status).
Validation is strict and happens before any construction: a non-empty
selection is required, txids must match the canonical 64-hex-character
pattern, output addresses must pass the address regex and the `Address`
decoder, and amounts must be positive integers.

Because the Esplora API does not return the full previous transaction for an
UTXO, BitLab constructs witness-utxo style inputs (`witnessUtxo`: previous
script plus amount) for all input types. Legacy P2PKH inputs set
`allowLegacyWitnessUtxo: true` on the `Transaction` for this reason. This is a
deliberate, documented trade-off, not an oversight.

## Fee estimation

Fees are expressed in satoshis per virtual byte (sat/vB). Before signing,
`estimateVsize()` approximates the transaction weight from per-item
constants:

| Item | Virtual size |
| --- | --- |
| Transaction header | 10.5 vB |
| Legacy P2PKH input | 148 vB |
| SegWit P2WPKH input | 57.5 vB |
| Taproot P2TR input | 57.5 vB |
| Legacy output | 34 vB |
| P2SH output | 32 vB |
| SegWit v0 output | 31 vB |
| Taproot output | 43 vB |
| OP_RETURN output | 43 vB |

The estimate is `header + inputs + outputs + one change output`. The actual
fee charged is then read back from the signed transaction (`tx.fee`), so the
UI displays a real number, not the estimate. The fee slider is seeded with
the live `v1/fees/recommended` estimates (fastest, half hour, hour, economy)
from the mempool facade.

Change is returned to a wallet-owned address and only if it clears the dust
limit. `DUST_LIMIT` is 546 satoshis: outputs below it would be
uneconomical for miners to relay, so BitLab refuses to create them and lets
the amount fall into the fee instead.

## Signing

`tx.sign(privateKey)` signs every input with the wallet key. For Taproot
inputs, the 32-byte x-only internal key is attached to each input
(`tapInternalKey`) so that `@scure/btc-signer` can produce a Schnorr
key-path signature. The key is derived locally from the private key and never
leaves the browser. After signing, `tx.finalize()` produces the witness data
and the serializable hex.

## The raw transaction decoder

`decodeRawTx()` turns a raw hex string into a `DecodedTx` structure: txid,
version, locktime, byte size, virtual size, signature state, and a
per-input and per-output breakdown. It is intentionally tolerant — unknown
inputs and outputs are accepted and PSBT fields are ignored — because its
job is pedagogy, not consensus validation.

Output scripts are classified by `detectScriptType()` using canonical byte
patterns:

| Pattern | Type |
| --- | --- |
| `0x6a` prefix | OP_RETURN (payload decoded as UTF-8 when possible) |
| `0x00 0x14` + 20 bytes | SegWit v0 (P2WPKH) |
| `0x00 0x20` + 32 bytes | SegWit v0 (P2WSH) |
| `0x51 0x20` + 32 bytes | Taproot |
| `76 a9 … 88 ac` (25 bytes) | Legacy P2PKH |
| `a9 … 87` (23 bytes) | P2SH |

`scriptToAddress()` converts each recognized script back into a human-readable
address for the active network. Round-tripping addresses through scripts and
back is covered by the offline tests.

## Multisig workshop

`createMultisig(pubkeysHex, m)` builds an m-of-n native P2WSH multisig
address from compressed public keys (66 or 130 hex characters each). It
returns the address, the redeem script and the witness script, all as hex.
The transaction builder displays these so students can fund the address and
inspect what a cooperative spend would look like. Full co-signing of
multisig inputs is a known future extension, not a current feature.

## Broadcasting

`mpBroadcast(rawHex)` posts the hex as plain text to
`/api/bitcoin?path=tx&network=<active>`. The server route accepts only this
path for POST, validates the payload shape (hexadecimal, at least 120
characters) and relays it to the active network's Esplora endpoint with a
15-second timeout. The response body is the txid on success, or the node's
refusal message, which the UI shows verbatim. BitLab never retries a
broadcast automatically: a rejected transaction must be a conscious decision,
especially on mainnet.

## Public API summary

| Export | Purpose |
| --- | --- |
| `draftTx(params)` | Assemble an unsigned transaction |
| `buildSignedTx(params)` | Estimate fees, apply change, sign, finalize |
| `estimateVsize(...)` | Pre-sign virtual size estimate |
| `decodeRawTx(hex)` | Human-readable decode of raw transaction hex |
| `detectScriptType(script)` | Classify an output script |
| `createMultisig(pubkeys, m)` | m-of-n P2WSH address and scripts |
| `addressToScript(address)` | Address to scriptPubKey for the active network |
| `DUST_LIMIT` | 546 sats, the minimum output amount |

## Related documentation

- Where UTXOs come from: [Wallets and keys](./wallet-and-keys.md),
  [Networks](./networks.md).
- Why the proxy validates payloads this way:
  [Security model](./security-model.md).
- The tests covering this module: [Testing and CI](./testing-and-ci.md).
