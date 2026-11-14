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

Pour fermer la boucle avec BitQuest, le module lightning doit afficher
un CTA « Soumettre ce canal à BitQuest » dès qu'un canal est prêt.

### Pré-requis déjà en place

| Pièce | Fichier | État |
|---|---|---|
| Mission courante (store Zustand) | `src/lib/bitquest-mission-store.ts` | ✅ |
| Hook de lecture mission + tab | `src/lib/use-bitquest-mission.ts` | ✅ |
| `LnChannelView.scidFormatted` | `src/lib/lightning.ts` (ligne 40) | ✅ |
| `buildReturnUrl(mission, value)` | `src/lib/bitquest-bridge.ts` (ligne 187) | ✅ |
| Validation CHANNEL scid | `isValidReturnValue('CHANNEL', ...)` (ligne 167) | ✅ |

### Intégration à faire dans `src/components/bitlab/lightning.tsx`

1. `const mission = useBitquestMissionStore((s) => s.mission)` — lire
   la mission courante.
2. Garder le CTA conditionnel : `mission?.kind === 'CHANNEL'` **et**
   `channel.isReady === true` **et** `channel.scidFormatted` non
   `undefined` (filtrer les canaux sans scid annoncé ni alias).
3. Au clic, appeler :
   ```ts
   const url = buildReturnUrl(mission, channel.scidFormatted!);
   window.location.href = url;
   ```
   Pas d'ouverture d'onglet : la navigation **top-level** est
   indispensable pour conserver la session BitQuest (cookies
   SameSite=Lax).

### Bords à surveiller

- Canal `isReady` mais **privé/non annoncé** sans alias : `scidFormatted`
  reste `undefined`. L'UI doit alors afficher un hint « Attends ~3
  confirmations » plutôt que de masquer le canal.
- Plusieurs canaux prêts simultanément : le CTA doit être **par ligne**
  (pas un bouton global) pour permettre à l'apprenant de choisir lequel
  déclarer.
- Après le clic, pas besoin de confirmation locale : BitQuest renvoie
  l'apprenant avec `bitlab_result=1` et affichera le statut officiel.

### Pas de HMAC côté BitLab

C'est BitQuest qui vérifie à la réception via
`POST /api/bitlab/deep-link/verify-return`. `ts` et `sig` (s'ils
existaient dans l'URL entrante) sont échoés tels quels par
`buildReturnUrl`.

## Build WASM

La chaîne d'outillage est `cargo build --target wasm32-unknown-unknown`
+ `wasm-bindgen --target no-modules` (pas `wasm-pack`). Le script
`scripts/build-lnlab.sh` fait l'orchestration et pose les artefacts
dans `public/lnlab/` avec un hash de busting cache.

```bash
# Depuis la racine bitlab/
./scripts/build-lnlab.sh
```

Pré-requis locaux :
- `rustup target add wasm32-unknown-unknown`
- `cargo install wasm-bindgen-cli --version 0.2.100 --locked`

Les clients BitLab verront les nouveaux champs au prochain reload
(service-worker + hash WASM dans l'URL = pas de cache stale).

## Limites

- Canal **privé non annoncé** sans alias scid : `shortChannelId` restera
  absent jusqu'à ce que LDK émette un alias. Les tests en regtest
  peuvent l'observer immédiatement, les tests signet/testnet attendent
  généralement les 3 confirmations.
- Le u64 brut dépasse la précision de `Number` JS → utilise toujours
  `scidFormatted` ou les 3 composantes décomposées pour construire des
  requêtes, **jamais** `Number(shortChannelId)`.
