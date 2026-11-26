# channel_scid — automatic Lightning capture for BitQuest (LOT 11)

## Problem

The BitQuest ↔ BitLab protocol accepts `CHANNEL` type proofs which
take a `scid` (short channel ID) in `block × tx × vout` format
(e.g.: `840000x5x0`). Until now, the learner had to manually
copy/paste this scid after opening a Lightning channel in the lab.
High friction and a source of errors.

## Delivered change

**Rust / WASM side** (`rust/lnlab/src/lib.rs`, `channels_of`):

The JS object exposed for each channel now includes 5 new fields
when a scid is available:

- `shortChannelId`: raw scid (u64 → string, >= 2^53 possible).
- `scidBlock`: block height where the funding tx is confirmed.
- `scidTxIndex`: index of the tx within the block.
- `scidVout`: index of the funding output in the tx.
- `scidFormatted`: `"{block}x{tx}x{vout}"` — form directly
  usable in BitQuest.

Resolution priority (identical to `node.rs::channel_scid`):

1. `short_channel_id` (officially announced after 3 confirmations)
2. `outbound_scid_alias` (alias emitted by this node)
3. `inbound_scid_alias` (alias received from the counterparty)

If none of the three exists (private channel just opened), the 5 fields
are **absent from the object** — the TS code must use `?.` to access
them.

**TypeScript side** (`src/lib/lightning.ts`):

The `LnChannelView` interface is extended with the 5 optional fields. All
the rest of the UI (listing, debug, lightning module) continues to
work without modification — the fields are simply made
available to consumers that need them.

## Next step — auto capture UX

To close the loop with BitQuest, the lightning module must display
a "Submit this channel to BitQuest" CTA as soon as a channel is ready.

### Prerequisites already in place

| Piece | File | Status |
|---|---|---|
| Current mission (Zustand store) | `src/lib/bitquest-mission-store.ts` | ✅ |
| Mission + tab reading hook | `src/lib/use-bitquest-mission.ts` | ✅ |
| `LnChannelView.scidFormatted` | `src/lib/lightning.ts` (line 40) | ✅ |
| `buildReturnUrl(mission, value)` | `src/lib/bitquest-bridge.ts` (line 187) | ✅ |
| CHANNEL scid validation | `isValidReturnValue('CHANNEL', ...)` (line 167) | ✅ |

### Integration to do in `src/components/bitlab/lightning.tsx`

1. `const mission = useBitquestMissionStore((s) => s.mission)` — read
   the current mission.
2. Keep the conditional CTA: `mission?.kind === 'CHANNEL'` **and**
   `channel.isReady === true` **and** `channel.scidFormatted` not
   `undefined` (filter out channels without announced scid or alias).
3. On click, call:
   ```ts
   const url = buildReturnUrl(mission, channel.scidFormatted!);
   window.location.href = url;
   ```
   No tab opening: **top-level** navigation is
   essential to preserve the BitQuest session (SameSite=Lax
   cookies).

### Edge cases to watch

- Channel `isReady` but **private/unannounced** without alias: `scidFormatted`
  stays `undefined`. The UI must then show a hint "Wait ~3
  confirmations" rather than hide the channel.
- Multiple channels ready simultaneously: the CTA must be **per row**
  (not a global button) to allow the learner to choose which one to
  declare.
- After the click, no need for local confirmation: BitQuest returns
  the learner with `bitlab_result=1` and will display the official status.

### No HMAC on the BitLab side

BitQuest is the one that verifies on reception via
`POST /api/bitlab/deep-link/verify-return`. `ts` and `sig` (if they
existed in the incoming URL) are echoed as-is by
`buildReturnUrl`.

## WASM Build

The toolchain is `cargo build --target wasm32-unknown-unknown`
+ `wasm-bindgen --target no-modules` (not `wasm-pack`). The
`scripts/build-lnlab.sh` script handles the orchestration and places the artifacts
in `public/lnlab/` with a cache-busting hash.

```bash
# From the bitlab/ root
./scripts/build-lnlab.sh
```

Local prerequisites:
- `rustup target add wasm32-unknown-unknown`
- `cargo install wasm-bindgen-cli --version 0.2.100 --locked`

BitLab clients will see the new fields on the next reload
(service-worker + WASM hash in the URL = no stale cache).

## Limitations

- **Private unannounced channel** without scid alias: `shortChannelId` will
  remain absent until LDK emits an alias. Regtest tests
  can observe it immediately, signet/testnet tests generally wait
  for the 3 confirmations.
- The raw u64 exceeds JS `Number` precision → always use
  `scidFormatted` or the 3 decomposed components to build
  requests, **never** `Number(shortChannelId)`.
