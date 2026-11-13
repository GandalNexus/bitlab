# channel_scid — capture auto Lightning pour BitQuest (LOT 11)

## Problème

Le protocole BitQuest ↔ BitLab accepte des preuves de type `CHANNEL` qui
prennent un `scid` (short channel ID) au format `block × tx × vout`
(ex : `840000x5x0`). Jusqu'ici, l'apprenant devait copier/coller
manuellement ce scid après avoir ouvert un canal Lightning dans le
labo. Friction forte et source d'erreurs.

## Changement livré

**Côté Rust / WASM** (`rust/lnlab/src/lib.rs`, `channels_of`) :

L'objet JS exposé pour chaque canal inclut désormais 5 nouveaux champs
quand un scid est disponible :

- `shortChannelId` : scid brut (u64 → string, >= 2^53 possible).
- `scidBlock` : hauteur de bloc où la tx de funding est confirmée.
- `scidTxIndex` : index de la tx dans le bloc.
- `scidVout` : index de l'output funding dans la tx.
- `scidFormatted` : `"{block}x{tx}x{vout}"` — forme directement
  utilisable dans BitQuest.

Priorité de résolution (identique à `node.rs::channel_scid`) :

1. `short_channel_id` (annoncé officiel après 3 confirmations)
2. `outbound_scid_alias` (alias émis par ce nœud)
3. `inbound_scid_alias` (alias reçu de la contre-partie)

Si aucun des trois n'existe (canal privé juste ouvert), les 5 champs
sont **absents de l'objet** — le code TS doit utiliser `?.` pour y
accéder.

**Côté TypeScript** (`src/lib/lightning.ts`) :

L'interface `LnChannelView` étend avec les 5 champs optionnels. Tout
le reste de l'UI (listing, debug, module lightning) continue de
fonctionner sans modification — les champs sont simplement rendus
disponibles aux consommateurs qui en ont besoin.

## Prochaine étape — UX capture auto

Pour fermer la boucle avec BitQuest, il reste à :

1. Dans le module lightning du labo, détecter que l'apprenant est en
   mission `kind=CHANNEL` (via `useBitquestMission` → `mission.kind`).
2. Observer la liste des canaux (`channels_of`) au polling.
3. Dès qu'un canal `isReady === true` avec `scidFormatted` apparaît,
   proposer un CTA « Soumettre ce canal à BitQuest » qui :
   - construit l'URL de retour `returnTo?bitlab_result=1&scid=<scidFormatted>`
   - navigue top-level vers cette URL.

Pas de HMAC côté BitLab (c'est BitQuest qui vérifie à la réception via
`/api/bitlab/deep-link/verify-return`).

## Build WASM

Après modification du fichier Rust, rebuild le WASM :

```bash
cd rust/lnlab
wasm-pack build --target web --out-dir ../../public/wasm/lnlab --release
```

Les clients BitLab verront les nouveaux champs dès le rechargement.

## Limites

- Canal **privé non annoncé** sans alias scid : `shortChannelId` restera
  absent jusqu'à ce que LDK émette un alias. Les tests en regtest
  peuvent l'observer immédiatement, les tests signet/testnet attendent
  généralement les 3 confirmations.
- Le u64 brut dépasse la précision de `Number` JS → utilise toujours
  `scidFormatted` ou les 3 composantes décomposées pour construire des
  requêtes, **jamais** `Number(shortChannelId)`.
