# Wallets and Keys

This document is the reference for the wallet module: how BitLab generates,
imports, derives and stores key material. The implementation lives in
`src/lib/bitcoin/keys.ts`, backed by `src/lib/networks.ts` for derivation
paths and by `src/lib/store.ts` for persistence.

## The cardinal rule

All functions in `src/lib/bitcoin/` run in the browser. Private keys,
mnemonics and WIF strings are never sent to the server, never logged, and
never persisted outside the browser's IndexedDB. This is the project's
zero-knowledge protocol, described in full in
[Security model](./security-model.md). Any change that would send key
material across the network is a critical bug by definition.

## Address types

BitLab supports the three standard single-signature address families. The
`TYPE_INFO` table in `keys.ts` is the source of truth, including the UI copy
shown to students.

| Type | Script | BIP | Derivation path (testnet) | Address prefix | Trade-off |
| --- | --- | --- | --- | --- | --- |
| Legacy | P2PKH | BIP-44 | `m/44'/1'/0'/0/0` | `m…` / `n…` | Historical format, largest scripts, highest fees |
| SegWit | P2WPKH | BIP-84 | `m/84'/1'/0'/0/0` | `tb1q…` | About 40 percent cheaper than legacy, the recommended default |
| Taproot | P2TR | BIP-86 | `m/86'/1'/0'/0/0` | `tb1p…` | Schnorr signatures, script privacy (MAST), bech32m encoding |

On mainnet the coin type changes from `1'` to `0'` and addresses use `bc1q…`,
`bc1p…`, `1…` and `3…` prefixes. The substitution is centralized in
`pathForNetwork()`; no caller needs to know the coin type convention.

## Wallet sources

`LabWallet.source` records how a wallet entered the lab:

- **`generated`** — `createWallet(type, words)` produces a fresh BIP-39
  mnemonic (128 bits of entropy for 12 words, 256 bits for 24 words) from the
  audited English wordlist, then delegates to the mnemonic importer.
- **`mnemonic`** — `walletFromMnemonic(mnemonic, type)` validates the phrase
  (words and checksum), derives the seed synchronously, walks the BIP-32 path
  for the selected address type and network, and derives the address from the
  compressed public key. Importing the same mnemonic twice yields the same
  address; this determinism is covered by the test suite.
- **`wif`** — `walletFromWif(wif, type)` decodes a Wallet Import Format string
  with the network parameters of the active network. A WIF encoded for
  mainnet is rejected on testnet and vice versa; the error message says so
  explicitly.

Mnemonic validation is exposed separately as `checkMnemonic()`, which returns
a boolean instead of throwing, for form-level validation.

## What derivation produces

For each wallet the lab keeps:

| Field | Content |
| --- | --- |
| `address` | The display and receiving address |
| `publicKeyHex` | 33-byte compressed secp256k1 public key |
| `privateKeyHex` | 32-byte private key (hex, browser only) |
| `wif` | The private key in Wallet Import Format for the active network |
| `mnemonic` | Present for generated and mnemonic wallets; absent for WIF imports |
| `derivationPath` | The BIP-32 path used, for example `m/84'/1'/0'/0/0` |
| `network` | The `NetId` the wallet was derived for |
| `type`, `source`, `label`, `id`, `createdAt` | Display and bookkeeping metadata |

Taproot deserves one note: P2TR uses a 32-byte x-only internal key. BitLab
derives it by dropping the leading parity byte of the compressed public key
(`pub.slice(1)`) and lets `@scure/btc-signer` apply the BIP-86 tweak. The
same x-only key is reused later as `tapInternalKey` when signing Taproot
inputs in the transaction builder.

## Storage

The store persists every wallet list mutation into IndexedDB (database entry
`bitlab-lab-state-v1`) together with the active wallet id and the active
network. Concretely:

- Storage is per-browser and per-origin. Clearing site data destroys the lab
  wallets, which is acceptable for a teaching tool: nothing of value is ever
  stored there, and the mnemonic allows exact recovery.
- There is no export or sync mechanism, on purpose. The mnemonic and the WIF
  are the export format.
- If IndexedDB is unavailable, the lab degrades to an in-memory session
  instead of failing.

## Public API summary

All exports live in `src/lib/bitcoin/keys.ts` and are pure functions:

| Function | Purpose |
| --- | --- |
| `createWallet(type, words?)` | Generate a wallet from a fresh mnemonic |
| `walletFromMnemonic(mnemonic, type, label?, source?, net?)` | Import or derive from a BIP-39 phrase |
| `walletFromWif(wif, type, label?, net?)` | Import from a WIF string |
| `deriveForType(privBytes, type, net?)` | Address and public key from a private key |
| `checkMnemonic(mnemonic)` | Non-throwing validity check |

## Related documentation

- Choosing where coins come from: [Networks](./networks.md) and its faucet
  table.
- Spending from these wallets: [Transactions](./transactions.md).
- Storage rules and their rationale: [Security model](./security-model.md).
