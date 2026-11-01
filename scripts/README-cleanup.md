# Nettoyage horaire des commentaires — BitLab

Outil d'harmonisation linguistique du code : suppression programmée des **commentaires français et anglais** de tous les fichiers sources. La documentation du code vivra dans un document séparé (à venir), les sources restent donc sans commentaires, en anglais uniquement pour ce qui est technique (identifiants, messages de commit, directives).

## Composants

| Fichier | Rôle |
|---|---|
| `scripts/cleanup-comments.mjs` | Stripper lexical multi-langue (TS/TSX/JS/MJS, Rust, Shell) avec vérification par tokens |
| `scripts/cleanup-scheduler.mjs` | Rotation horaire : 1 dossier par heure, garde-fous, commit git, backup zip |
| `backups/` (gitignoré) | Zips `backup-bitlab-<HH>h.zip`, `cleanup-state.json` (progression), `cleanup-log.txt` (journal) |

## Fonctionnement du scheduler

Rotation d'un dossier **par heure** :

1. `src/lib` 2. `src/components/bitlab` 3. `src/components/ui+hooks` 4. `src/app` 5. `tests` 6. `scripts` 7. `rust/lnlab/src` 8. `rust/miner/src` 9. `public` (workers main-d'œuvre)

Chaque cycle :

1. **Self-test lexical** (27 cas piégeux : URLs, regex, templates imbriqués, JSX, raw strings Rust, heredocs shell).
2. **Strip** du dossier courant — le lexer distingue commentaires / strings / templates / regex / texte JSX / heredocs, et préserve :
   - les **bannières de licence** (`@license`, `@copyright`, SPDX…) en tête de fichier ;
   - les **directives techniques** (`@ts-expect-error`, `eslint-disable*`, `@vitest-environment`, `webpack*`, `sourceMappingURL`, `/// <reference>`) ;
   - les **shebangs** (`#!`).
3. **Vérification par tokens** : le fichier nettoyé est re-lexé et sa séquence de tokens doit être strictement identique à l'originale (à normalisation près du whitespace JSX, conformément à la spec). Tout écart → exception → rollback du dossier.
4. **Garde-fous qualité** (si `node_modules` présent) : `tsc --noEmit` puis `vitest run`. Échec → `git checkout --` des fichiers modifiés (rollback complet), journalisation, passage au dossier suivant.
5. **Commit** Conventional Commits : `chore(comments): strip FR+EN comments from <dossier> (<n> comments, <m> lines)`.
6. **Backup zip** : `git archive HEAD` → `backups/backup-bitlab-<HH>h.zip` (heure locale Africa/Dakar ; un zip de même nom est écrasé).

À la **fin du premier cycle** (9e dossier traité), une archive finale supplémentaire `backups/backup-bitlab-final-<HH>h-avec-git.zip` est produite : elle contient l'arbre de travail **et le dossier `.git`** complet (historique des commits de cleanup inclus). Exclusions : `node_modules/`, `backups/`, `.next/`, `target/`, `next-dev/`. Elle n'est créée qu'une seule fois (garde `finalArchiveDone` dans `cleanup-state.json`).

Après les 9 dossiers, le scheduler passe en **mode maintenance** : il re-scanne un dossier par heure (round-robin) et nettoie tout nouveau commentaire introduit entre-temps ; sans changement, aucun commit ni zip n'est produit.

## Utilisation

```bash
node scripts/cleanup-scheduler.mjs            # cycle courant (dossier suivant)
node scripts/cleanup-scheduler.mjs --status   # état complet : progression, journal, backups, commits
node scripts/cleanup-scheduler.mjs --dry-run  # simulation sans écriture ni commit
node scripts/cleanup-scheduler.mjs --reset    # repartir du premier dossier

node scripts/cleanup-comments.mjs <cible> [--dry-run] [--self-test] [--json]
```

Automatisation en place : cron job toutes les heures à :00 (Africa/Dakar) qui exécute le cycle courant et rapporte le résultat. Équivalent machine locale :

```cron
0 * * * *  cd /chemin/vers/bitlab && node scripts/cleanup-scheduler.mjs >> backups/cleanup-log.txt 2>&1
```

## Choix de conception

- **Strings UI françaises préservées** : les clés du dictionnaire `i18n-dict.ts` (`t('phrase française')`) constituent le produit bilingue FR/EN, pas des commentaires — elles ne sont jamais touchées.
- **Fichiers générés exclus** : `*.d.ts`, `*_bg.js` (glue wasm-bindgen), `.wasm` — régénérés au build, leur nettoyage n'aurait aucun effet durable.
- **Code collé garanti** : un commentaire en milieu de ligne est remplacé par un espace exactement quand les tokens voisins exigent une séparation ; une ligne ne contenant qu'un commentaire est supprimée avec son retour à la ligne (l'ASI de JavaScript ne peut jamais être affecté : deux lignes de code adjacentes conservent toujours leur newline).
- **State hors git** : `backups/` est gitignoré ; l'historique de nettoyage vit dans les commits git eux-mêmes.
- **Baseline validée** avant mise en service : `tsc --noEmit` = 0 erreur et `vitest run` = 92/92 tests, à l'identique avant et après un strip complet du périmètre.

## Suivi (rapport du matin)

```bash
node scripts/cleanup-scheduler.mjs --status   # qui a été traité, combien de commentaires, quels commits/backups
git log --oneline -15                         # les commits chore(comments) horaires
ls backups/                                   # les zips horaires
cat backups/cleanup-log.txt                   # le journal détaillé
```

Rollback d'un dossier si besoin : `git revert <commit>` ou `git checkout <commit>^ -- <dossier>`.
