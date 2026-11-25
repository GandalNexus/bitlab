# Third-party notices — BitLab

BitLab is licensed under **AGPL-3.0-or-later** (see `LICENSE`).
This file inventories the third-party dependencies and their licenses,
as shipped in version 0.4.7. Their own license terms apply to each of them.

## npm dependencies (declared)

| Package | Version | License |
|---|---|---|
| @noble/hashes | 2.4.0 | MIT |
| @radix-ui/react-checkbox | 1.4.1 | MIT |
| @radix-ui/react-collapsible | 1.2.1 | MIT |
| @radix-ui/react-dialog | 1.3.1 | MIT |
| @radix-ui/react-dropdown-menu | 2.2.1 | MIT |
| @radix-ui/react-label | 2.1.17 | MIT |
| @radix-ui/react-select | 2.4.1 | MIT |
| @radix-ui/react-separator | 1.2.0 | MIT |
| @radix-ui/react-slider | 1.6.1 | MIT |
| @radix-ui/react-slot | 1.5.0 | MIT |
| @radix-ui/react-switch | 1.4.1 | MIT |
| @radix-ui/react-tabs | 1.2.1 | MIT |
| @radix-ui/react-toast | 1.3.1 | MIT |
| @radix-ui/react-toggle | 1.2.1 | MIT |
| @radix-ui/react-tooltip | 1.4.1 | MIT |
| @scure/base | 2.4.0 | MIT |
| @scure/bip32 | 2.4.0 | MIT |
| @scure/bip39 | 2.4.0 | MIT |
| @scure/btc-signer | 2.4.1 | MIT |
| @tailwindcss/postcss | 4.3.5 | MIT |
| @tanstack/react-query | 5.107.1 | MIT |
| @types/qrcode | 1.5.6 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| bolt11 | 1.4.2 | MIT |
| brace-expansion | 5.0.13 | MIT |
| bun-types | 1.4.4 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| clsx | 2.1.1 | MIT |
| esbuild | 0.28.2 | MIT |
| eslint | 10.15.0 | MIT |
| eslint-config-next | 16.4.6 | MIT |
| eslint-config-prettier | 10.1.8 | MIT |
| idb-keyval | 6.3.0 | Apache-2.0 |
| lucide-react | 1.73.0 | ISC |
| minimatch | 11.0.8 | BlueOak-1.0.0 |
| next | 16.4.6 | MIT |
| picomatch | 4.0.7 | MIT |
| prettier | 3.10.1 | MIT |
| prettier-plugin-tailwindcss | 0.8.1 | MIT |
| qrcode | 1.5.4 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| tailwind-merge | 3.7.0 | MIT |
| tailwindcss | 4.3.5 | MIT |
| tw-animate-css | 1.4.0 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest | 5.1.0 | MIT |
| zustand | 5.1.0 | MIT |

Full transitive resolution: **490 distinct packages** (histogram: mostly MIT, plus ISC, BSD-2/3-Clause, Apache-2.0, MPL-2.0, CC0-1.0, CC-BY-4.0). Notable non-MIT items: `axe-core` and `lightningcss` (MPL-2.0, build/tooling only), `@img/sharp-libvips-*` (LGPL-3.0, native server-side image binaries, **not** shipped in the browser bundle), `caniuse-lite` (CC-BY-4.0 data), `language-subtag-registry` (CC0-1.0 data).

## Rust crates compiled to WebAssembly

| Crate | Version | License |
|---|---|---|
| arrayvec | 0.7.8 | MIT OR Apache-2.0 |
| base58ck | 0.1.101 | CC0-1.0 |
| bech32 | 0.11.1 | MIT |
| bitcoin | 0.32.102 | CC0-1.0 |
| bitcoin-consensus-encoding | 1.3.0 | CC0-1.0 |
| bitcoin-internals | 0.7.0 | CC0-1.0 |
| bitcoin-io | 0.1.101 | CC0-1.0 |
| bitcoin-units | 0.1.101 | CC0-1.0 |
| bitcoin_hashes | 0.14.101 | CC0-1.0 |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 |
| cc | 1.9.0 | MIT OR Apache-2.0 |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 |
| console_error_panic_hook | 0.1.7 | Apache-2.0/MIT |
| dnssec-prover | 0.6.10 | MIT OR Apache-2.0 |
| find-msvc-tools | 0.1.15 | MIT OR Apache-2.0 |
| getrandom | 0.2.17 | MIT OR Apache-2.0 |
| hashbrown | 0.13.2 | MIT OR Apache-2.0 |
| hex-conservative | 0.2.3 | CC0-1.0 |
| hex-conservative | 1.3.0 | CC0-1.0 |
| hex_lit | 0.1.1 | MITNFA |
| js-sys | 0.3.77 | MIT OR Apache-2.0 |
| libc | 0.2.191 | MIT OR Apache-2.0 |
| libm | 0.2.16 | MIT |
| lightning | 0.2.7 | MIT OR Apache-2.0 |
| lightning-invoice | 0.34.1 | MIT OR Apache-2.0 |
| lightning-macros | 0.2.1 | MIT OR Apache-2.0 |
| lightning-types | 0.3.5 | MIT OR Apache-2.0 |
| log | 0.4.34 | MIT OR Apache-2.0 |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| possiblyrandom | 0.2.1 | MIT OR Apache-2.0 |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| rustversion | 1.0.23 | MIT OR Apache-2.0 |
| secp256k1 | 0.29.1 | CC0-1.0 |
| secp256k1-sys | 0.10.1 | CC0-1.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| serde_core | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 |
| shlex | 2.0.1 | MIT OR Apache-2.0 |
| syn | 2.0.119 | MIT OR Apache-2.0 |
| syn | 3.0.9 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| wasi | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| wasm-bindgen | 0.2.100 | MIT OR Apache-2.0 |
| wasm-bindgen-backend | 0.2.100 | MIT OR Apache-2.0 |
| wasm-bindgen-macro | 0.2.100 | MIT OR Apache-2.0 |
| wasm-bindgen-macro-support | 0.2.100 | MIT OR Apache-2.0 |
| wasm-bindgen-shared | 0.2.100 | MIT OR Apache-2.0 |

Notes: the `bitcoin` 0.32 family (rust-bitcoin org) is **CC0-1.0** (public-domain dedication). The Lightning stack is **rust-lightning / LDK**, dual **MIT OR Apache-2.0**. No copyleft license (GPL/AGPL/LGPL family) appears among the Rust crates; the single LGPL-3.0 item in the whole tree is a native libvips binary used at build time only.
