/**
 * BitLab — Moteur regtest embarqué : hôte serveur (singleton + disque).
 *
 * Ce module n'est importé que par les routes API (runtime Node/Bun) : il
 * détient l'unique instance de `RegtestChain` par processus (globalThis,
 * tolérant au hot-reload Next.js) et la persiste en JSON atomique (tmp +
 * rename) dans un répertoire de données local, avec écriture différée de
 * 400 ms — le minage burst de 500 blocs ne provoque qu'un seul flush.
 *
 * Emplacement : BITLAB_DATA_DIR (défaut : <projet>/.bitlab/regtest-chain.json).
 * La chaîne est un artefact de labo sans valeur : sa corruption entraîne
 * une recréation propre (préminage faucet), jamais une erreur fatale.
 */
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { RegtestChain, type SerializedChain } from './chain';

const FLUSH_DELAY_MS = 400;

const globalRef = globalThis as {
  __bitlabRegtestChain?: RegtestChain;
  __bitlabRegtestTimer?: ReturnType<typeof setTimeout>;
  __bitlabRegtestFlush?: Promise<void>;
  __bitlabRegtestReload?: Promise<RegtestChain>;
  /** Évaluations cumulées du module, tous bundles de routes confondus. */
  __bitlabRegtestEpoch?: number;
  /** Époque à laquelle l'instance en cache a été construite. */
  __bitlabRegtestBuiltAt?: number;
};

// Chaque (ré)évaluation du module incrémente le compteur partagé : démarrage
// du process, hot-reload Next.js d'un fichier du moteur — et, en dev, chaque
// bundle de /api/* réévalue le module à sa première utilisation. Comparer
// l'époque courante à celle de construction de l'instance en cache détecte
// tout changement de code du moteur sans dépendre de l'identité de classe
// (un `instanceof` échouerait à chaque route : une classe par bundle).
globalRef.__bitlabRegtestEpoch = (globalRef.__bitlabRegtestEpoch ?? 0) + 1;

function dataFile(): string {
  const dir = process.env.BITLAB_DATA_DIR || join(process.cwd(), '.bitlab');
  return join(dir, 'regtest-chain.json');
}

/** Charge la chaîne persistée ou crée une instance fraîche (préminage). */
async function load(): Promise<RegtestChain> {
  const file = dataFile();
  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw) as SerializedChain;
    return new RegtestChain(data);
  } catch {
    // Absente ou corrompue : chaîne neuve — comportement documenté du labo.
    try {
      await fs.mkdir(dirname(file), { recursive: true });
    } catch {
      /* disque non inscriptible : la chaîne reste en mémoire */
    }
    return new RegtestChain();
  }
}

/** Écriture atomique (tmp + rename) — jamais de fichier à moitié écrit. */
async function flushNow(chain: RegtestChain): Promise<void> {
  const file = dataFile();
  try {
    const dir = dirname(file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(chain.serialize()), 'utf8');
    await fs.rename(tmp, file);
  } catch {
    /* persistance impossible : la session reste utilisable en mémoire */
  }
}

function scheduleFlush(chain: RegtestChain): void {
  if (globalRef.__bitlabRegtestTimer) clearTimeout(globalRef.__bitlabRegtestTimer);
  globalRef.__bitlabRegtestTimer = setTimeout(() => {
    if (globalRef.__bitlabRegtestChain !== chain) return; // remplacée entre-temps
    globalRef.__bitlabRegtestTimer = undefined;
    globalRef.__bitlabRegtestFlush = flushNow(chain).finally(() => {
      globalRef.__bitlabRegtestFlush = undefined;
    });
  }, FLUSH_DELAY_MS);
  // Ne jamais bloquer l'arrêt du process sur un flush.
  if (typeof globalRef.__bitlabRegtestTimer === 'object' && 'unref' in globalRef.__bitlabRegtestTimer) {
    (globalRef.__bitlabRegtestTimer as { unref(): void }).unref();
  }
}

/**
 * Instance unique du processus (chargée paresseusement au 1er appel).
 *
 * Détection du hot-reload : l'instance est mise en cache sur `globalThis`
 * pour survivre aux rechargements de modules Next.js. Après une modification
 * du code du moteur (chain/verify…), l'instance héritée tourne encore avec
 * l'ANCIEN code de consensus/vérification — un correctif validé en test
 * resterait invisible du serveur live. Le compteur d'époque repère toute
 * réévaluation du module : l'état est flushé depuis l'ancienne instance puis
 * réhydraté avec le code courant (rechargement borné : une fois par bundle
 * de route après chaque changement, puis stable).
 */
export async function getRegtestChain(): Promise<RegtestChain> {
  const epoch = globalRef.__bitlabRegtestEpoch ?? 0;
  const cached = globalRef.__bitlabRegtestChain;
  if (cached && globalRef.__bitlabRegtestBuiltAt === epoch) return cached;
  if (!globalRef.__bitlabRegtestReload) {
    globalRef.__bitlabRegtestReload = (async () => {
      if (cached) await flushNow(cached); // préserver les mutations non flushées
      const fresh = await load();
      globalRef.__bitlabRegtestChain = fresh;
      globalRef.__bitlabRegtestBuiltAt = globalRef.__bitlabRegtestEpoch ?? 0;
      return fresh;
    })().finally(() => {
      globalRef.__bitlabRegtestReload = undefined;
    });
  }
  return globalRef.__bitlabRegtestReload;
}

/** Persistance différée après une mutation (mine, faucet, accept, reset).
 * Une instance orpheline (requête en vol lors d'un hot-reload) est ignorée :
 * seule l'instance courante a le droit d'écrire l'état — sinon un flush
 * différé d'avant rechargement écraserait l'état à jour du disque. */
export async function persist(chain: RegtestChain): Promise<void> {
  if (globalRef.__bitlabRegtestChain !== chain) return;
  scheduleFlush(chain);
}

/** Flush immédiat (reset, tests) — attend l'écriture effective. */
export async function flushRegtestChain(): Promise<void> {
  const chain = globalRef.__bitlabRegtestChain;
  if (!chain) return;
  if (globalRef.__bitlabRegtestFlush) await globalRef.__bitlabRegtestFlush;
  await flushNow(chain);
}

/** Réinitialise la chaîne (nouveau genèse + préminage) et purge le disque. */
export async function resetRegtestChain(): Promise<RegtestChain> {
  const fresh = new RegtestChain();
  globalRef.__bitlabRegtestChain = fresh;
  globalRef.__bitlabRegtestBuiltAt = globalRef.__bitlabRegtestEpoch ?? 0;
  if (globalRef.__bitlabRegtestTimer) {
    clearTimeout(globalRef.__bitlabRegtestTimer);
    globalRef.__bitlabRegtestTimer = undefined;
  }
  await flushNow(fresh);
  return fresh;
}
