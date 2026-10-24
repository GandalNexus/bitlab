/**
 * BitLab — engine hot-reload after code change (Vitest).
 *
 * Engine singleton lives on `globalThis` to survive Next.js module reload.
 * After engine code changes, inherited instance still runs with OLD code:
 * a validated engine fix remained invisible to live server (real bug:
 * "invalid Schnorr signature" persisting after BIP 341 sighash fix).
 *
 * These tests reproduce this mechanism with epoch counter: any module
 * re-evaluation increments epoch; instance whose construction epoch
 * is older is flushed then rehydrated from disk with current code —
 * without losing unflushed mutations.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RegtestChain } from '../src/lib/regtest-engine/chain';
import { getRegtestChain, persist, resetRegtestChain } from '../src/lib/regtest-engine/server';

// Isolation: engine persists in temp dir dedicated to test
// (never actual server dev state <project>/.bitlab).
process.env.BITLAB_DATA_DIR = mkdtempSync(join(tmpdir(), 'bitlab-hotreload-'));

interface EngineGlobal {
  __bitlabRegtestChain?: RegtestChain;
  __bitlabRegtestEpoch?: number;
  __bitlabRegtestBuiltAt?: number;
  __bitlabRegtestReload?: Promise<RegtestChain>;
}
const g = globalThis as unknown as EngineGlobal;

describe('singleton du moteur et hot-reload du code', () => {
  it('premier appel : instance fraîche (préminage 101) marquée à l’époque courante', async () => {
    g.__bitlabRegtestChain = undefined;
    g.__bitlabRegtestBuiltAt = undefined;
    const chain = await getRegtestChain();
    expect(chain).toBeInstanceOf(RegtestChain);
    expect(chain.info().height).toBe(101);
    expect(g.__bitlabRegtestBuiltAt).toBe(g.__bitlabRegtestEpoch);
  });

  it('instance à jour : renvoyée telle quelle (pas de rechargement)', async () => {
    const before = await getRegtestChain();
    const again = await getRegtestChain();
    expect(again).toBe(before);
  });

  it('réévaluation du module (hot-reload) : l’instance est remplacée par une réhydratée du disque', async () => {
    // Mutations confirmées sur disque + une mutation NON flushée (fenêtre
    // du différé de 400 ms) : ni l’une ni l’autre ne doit être perdue.
    const current = await getRegtestChain();
    current.mineTo(null, 3);
    const pending = await getRegtestChain();
    pending.mineTo(null, 2); // uniquement en mémoire (pas de flush demandé)

    // Simulation : un autre bundle réévalue le module → époque +1, tandis
    // que l’instance en cache a été construite à l’époque précédente.
    g.__bitlabRegtestEpoch = (g.__bitlabRegtestEpoch ?? 0) + 1;

    const reloaded = await getRegtestChain();
    expect(reloaded).not.toBe(current);
    expect(reloaded).toBeInstanceOf(RegtestChain);
    // L’état (y compris la mutation non flushée) a été préservé : 101 + 5.
    expect(reloaded.info().height).toBe(106);
    // La nouvelle instance est marquée construite à l’époque courante :
    // les appels suivants ne rechargent plus.
    expect(g.__bitlabRegtestBuiltAt).toBe(g.__bitlabRegtestEpoch);
    expect(await getRegtestChain()).toBe(reloaded);
  });

  it('plusieurs réévaluations consécutives : l’état s’accumule sans perte', async () => {
    for (let i = 0; i < 3; i++) {
      const c = await getRegtestChain();
      c.mineTo(null, 1);
      g.__bitlabRegtestEpoch = (g.__bitlabRegtestEpoch ?? 0) + 1;
    }
    const chain = await getRegtestChain();
    expect(chain.info().height).toBe(109);
  });

  it('reset : la nouvelle instance est marquée à jour (pas de rechargement fantôme)', async () => {
    const fresh = await resetRegtestChain();
    expect(fresh.info().height).toBe(101);
    expect(await getRegtestChain()).toBe(fresh);
  });

  it('persist d’une instance orpheline : n’écrase jamais l’état courant', async () => {
    const orphan = await getRegtestChain();
    const beforeHeight = orphan.info().height;
    // Hot-reload : l’instance orpheline est remplacée par une réhydratée.
    g.__bitlabRegtestEpoch = (g.__bitlabRegtestEpoch ?? 0) + 1;
    const current = await getRegtestChain();
    expect(current).not.toBe(orphan);
    // La requête en vol (orpheline) mute puis demande une persistance…
    orphan.mineTo(null, 4);
    await persist(orphan);
    // …et son différé éventuel (400 ms) ne doit rien écrire non plus.
    await new Promise((r) => setTimeout(r, 550));
    const after = await getRegtestChain();
    expect(after).toBe(current);
    expect(after.info().height).toBe(beforeHeight); // blocs orphelins ignorés
  });
});
