# Troubleshooting

This page maps symptoms to causes and fixes, from the most common to the
most technical. It covers the browser experience, the server proxy, the
Lightning lab and the development environment.

## Wallet and browser

**My wallets disappeared after clearing browser data.**
Wallets live in the site's IndexedDB by design; clearing site data clears
them. Restore a wallet from its mnemonic (Wallet module, import by phrase)
or its WIF. Nothing was lost as long as the mnemonic was written down — that
is exactly why the module insists on showing it.

**A wallet shows a balance of zero although I received coins.**
First, check the active network: a Testnet3 wallet shows nothing while the
lab is on Testnet4, and this is correct behavior, not a bug. Second, open
the Explorer module and look the address up directly; if the explorer shows
funds but the wallet does not, the Esplora proxy may have served a cached
response — wait 60 seconds for the cache to expire and retry.

**Importing a WIF fails with a network error message.**
WIF strings are network-specific. A mainnet WIF (`K…`, `L…`, `5…`) cannot be
imported while a test network is active, and vice versa. Switch the network
or use a WIF for the active network; the hint under the field shows the
expected prefix.

**Importing a mnemonic fails.**
The phrase is validated against the BIP-39 English wordlist including its
checksum. Check for typos, extra words, or a passphrase-only line pasted by
accident. BitLab does not support BIP-39 passphrases (the 25th word); adding
one produces a different wallet by design in serious wallets, and the lab
does not implement it.

## Network and data

**Requests fail with `502` and a message naming the network.**
The proxy could not reach the public Esplora node within its timeout. This
is usually transient congestion or a local network outage. Retry after a
moment; the 60-second cache may also have stored an error-free answer for a
previous identical request, so a fresh path (a different address) is a good
control.

**Requests fail with `400`.**
The proxy allow-list rejected the path. If this happens in normal usage, it
is a bug: the UI only calls allow-listed paths. If it happens because you
added a feature calling a new Esplora path, add that exact path to
`ALLOWED_GET` in `src/app/api/bitcoin/route.ts` and keep the pattern as
narrow as possible.

**Broadcasting returns the node's refusal text.**
The message is relayed verbatim from the node: `min relay fee not met`,
`txn-mempool-conflict`, `insufficient fee`, and similar. Read it as the
network's verdict. Raise the fee rate and rebuild; do not retry the same
transaction unchanged.

## Lightning lab

**The toggle says the module failed to boot.**
The Web Worker could not load or start the WASM module. Check, in order:
the browser supports WebAssembly and module workers (all evergreen browsers
do); the artifact is reachable (`/lnlab/lnlab_bg.wasm` returns 200 in the
developer tools' network tab — a stale service-worker cache or a partial
deployment is the usual culprit, and a hard reload fixes both); and the
console shows no Content-Security-Policy rejection. The lab only works on
Testnet3 and Signet; on Testnet4 or mainnet it stays disabled by design.

**The nodes show no block or the tip does not move.**
The chain feed comes from the same-origin Esplora proxy. If the Dashboard
module also looks frozen, the proxy cannot reach its upstream (transient
congestion or rate limiting); wait a minute and retry. The first chain
catch-up after activation can take a few seconds on a fresh network.

**My channel stays pending.**
A channel is usable after the funding transaction reaches the required
confirmation depth on the network. Fund the displayed P2WSH address from one
of your wallets, watch the funding txid in the Explorer, and the channel
turns ready once the depth is met.

**A payment fails with an insufficient-balance style error.**
Outbound capacity is what a node can spend inside the channel, not its
on-chain balance. If node A opened the channel, node B can only pay back
what flowed to it. Push an initial amount when opening the channel
(`push_msat`) or route a first payment from A to B to rebalance.

**I want everything stopped or reset.**
Deactivating the toggle stops the worker and flushes pending state; the
toggle's reset action (`lnLab.reset`) wipes seeds, channel monitors and
history from IndexedDB, and the next boot regenerates fresh identities.
Funds already locked in a funding transaction can only be recovered by the
nodes that owned them — reset with care.

## Development environment

**Port 3000 is already in use.**
Another process holds the port (a previous dev server, the standalone
server). Stop it, or start the dev server on another port for a session:
`bunx next dev -p 3100`. All API paths are relative, so the application
works identically.

**`bun run build` fails on the copy steps.**
The build script assembles the standalone output with `cp` steps (the
compiled client assets and `public/`, which contains the Lightning WASM
artifact). They assume a POSIX shell; on Windows, run them under WSL or Git
Bash. The Next.js compilation itself is platform-independent.

**Type errors in `.next/types` or stale behavior after switching branches.**
Development artifacts can go stale after big branch switches. Stop the dev
server, delete `.next/`, and restart `bun run dev`; the first compile takes
a few seconds longer.

**The language or theme flashes wrong at boot.**
Both are restored before hydration by a boot script in `app/layout.tsx`.
If you changed `theme.tsx`, `i18n.tsx` or the boot script and see a flash,
verify the script still runs before React hydrates and reads the same
storage keys.

## Reporting what these pages did not cover

If you hit a failure this page does not describe, open a bug report per
[CONTRIBUTING.md](../CONTRIBUTING.md) with the network, the module, the exact
on-screen error, and whether a private window reproduces it. Security-relevant
findings follow [SECURITY.md](../SECURITY.md) instead.
