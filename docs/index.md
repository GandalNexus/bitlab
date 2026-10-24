# BitLab Documentation

BitLab is a hands-on Bitcoin and Lightning Network laboratory. It lets a student
generate real wallets, build and sign real transactions, operate two real LDK
Lightning nodes, and observe the mempool, across four Bitcoin networks
(Testnet4, Testnet3, Signet and Mainnet). Every cryptographic operation happens
in the browser: private keys are derived, stored and used exclusively on the
client machine.

This documentation is written for developers who are new to the project,
including readers who are still learning Bitcoin fundamentals. It explains what
the tool does, how it is built, and how to work on it safely.

## Documentation map

| Document | Purpose | Type |
| --- | --- | --- |
| [Getting started](./getting-started.md) | Install the lab, run it, complete a first full session | Tutorial |
| [Architecture](./architecture.md) | Layers, design patterns, data flows, technology stack | Explanation |
| [Wallets and keys](./wallet-and-keys.md) | Key generation, derivation paths, address formats, storage | Reference |
| [Transactions](./transactions.md) | UTXO selection, fee estimation, signing, decoding, multisig | Reference |
| [Lightning](./lightning.md) | Real LDK nodes in the browser (WebAssembly), lifecycle, channels and payments | Reference |
| [Networks](./networks.md) | The network registry, the Esplora proxy, faucets | Reference |
| [Security model](./security-model.md) | The zero-knowledge protocol and its threat model | Explanation |
| [Testing and CI](./testing-and-ci.md) | The offline test suite, quality gates, GitHub Actions | How-to |
| [Troubleshooting](./troubleshooting.md) | Symptoms, causes and fixes for common problems | How-to |
| [Glossary](./glossary.md) | Bitcoin and project vocabulary used across the docs | Reference |

## Suggested reading paths

If you want to use the lab:

1. Read [Getting started](./getting-started.md) and follow it end to end.
2. Keep the [Glossary](./glossary.md) open in a second tab.
3. Read the in-application guide, available in the interface under `Guide`.

If you want to understand how the project works:

1. Read [Architecture](./architecture.md) first.
2. Then read the module references that interest you:
   [Wallets and keys](./wallet-and-keys.md),
   [Transactions](./transactions.md),
   [Lightning](./lightning.md),
   [Networks](./networks.md).
3. Read [Security model](./security-model.md) to understand the rules the
   codebase enforces and why they are non-negotiable.

If you want to contribute:

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow and the project
   rules.
2. Read [Architecture](./architecture.md) and
   [Testing and CI](./testing-and-ci.md).
3. Pick an issue, open a branch, and keep the four quality gates green.

## Where the documentation lives

The in-application `Guide` page teaches the user workflow (how to operate the
lab). This `docs/` directory teaches the codebase (how the lab is built and
maintained). Both are kept in sync with the code; if you change a documented
behavior, update the corresponding page in the same pull request.
