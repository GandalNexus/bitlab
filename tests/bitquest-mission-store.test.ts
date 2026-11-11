import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests du store Zustand `useBitquestMissionStore`.
 *
 * Vérifie que l'état mission survit au refresh (persistance
 * sessionStorage) et disparaît sur `clearMission`. L'env Vitest étant
 * `node`, on installe un shim `window.sessionStorage` avant chaque
 * import dynamique du module pour que le middleware `persist` pointe
 * sur un storage réel et non sur le noop SSR.
 */

class MemoryStorage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const MISSION = {
  questCode: 'tx-basics',
  kind: 'TX' as const,
  network: 'testnet4' as const,
  returnTo: 'https://bitquest.local/q/tx-basics',
  ts: null,
  sig: null,
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  // Installe un `window` minimal avec un sessionStorage avant l'import.
  // `createJSONStorage` lit cette fonction à chaque hydrate/persist, donc
  // il suffit que `globalThis.window.sessionStorage` existe au moment des
  // opérations Zustand (ce qui est le cas tant qu'on ne le détruit pas).
  (globalThis as unknown as { window: { sessionStorage: Storage } }).window = {
    sessionStorage: storage as unknown as Storage,
  };
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('useBitquestMissionStore — persistance sessionStorage', () => {
  it('persiste la mission dans sessionStorage quand setMission est appelé', async () => {
    const mod = await import('../src/lib/bitquest-mission-store');
    mod.useBitquestMissionStore.getState().setMission(MISSION);

    const raw = storage.getItem(mod.BITQUEST_MISSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.mission).toEqual(MISSION);
    expect(parsed.version).toBe(1);
  });

  it('restaure la mission après "refresh" (re-import du module avec sessionStorage pré-rempli)', async () => {
    // Phase 1 : première visite, set la mission
    {
      const mod = await import('../src/lib/bitquest-mission-store');
      mod.useBitquestMissionStore.getState().setMission(MISSION);
      mod.useBitquestMissionStore.getState().setLastTxid('a'.repeat(64));
    }

    // Phase 2 : simule un refresh — reset modules, nouveau store, même storage
    vi.resetModules();
    const mod2 = await import('../src/lib/bitquest-mission-store');
    // Zustand `persist` hydrate de manière synchrone depuis sessionStorage
    // (JSON string) — pas besoin d'attendre.
    const s = mod2.useBitquestMissionStore.getState();
    expect(s.mission).toEqual(MISSION);
    expect(s.lastTxid).toBe('a'.repeat(64));
  });

  it('clearMission réinitialise tout l\'état persisté', async () => {
    const mod = await import('../src/lib/bitquest-mission-store');
    const s = mod.useBitquestMissionStore.getState();
    s.setMission(MISSION);
    s.setLastTxid('b'.repeat(64));
    s.setLastBolt11('lnbc100n1p0abc');

    s.clearMission();

    const after = mod.useBitquestMissionStore.getState();
    expect(after.mission).toBeNull();
    expect(after.lastTxid).toBeNull();
    expect(after.lastBolt11).toBeNull();

    // sessionStorage doit aussi refléter l'effacement
    const raw = storage.getItem(mod.BITQUEST_MISSION_STORAGE_KEY);
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.mission).toBeNull();
    expect(parsed.state.lastTxid).toBeNull();
  });

  it('selectCurrentProofValue retourne la bonne valeur par kind', async () => {
    const mod = await import('../src/lib/bitquest-mission-store');
    mod.useBitquestMissionStore.getState().setMission({
      ...MISSION,
      kind: 'INVOICE',
    });
    mod.useBitquestMissionStore.getState().setLastBolt11('lnbc1abc');
    mod.useBitquestMissionStore.getState().setLastTxid('a'.repeat(64));

    const value = mod.selectCurrentProofValue(mod.useBitquestMissionStore.getState());
    expect(value).toBe('lnbc1abc');
  });

  it('selectCurrentProofValue retourne null si pas de mission', async () => {
    const mod = await import('../src/lib/bitquest-mission-store');
    const value = mod.selectCurrentProofValue(mod.useBitquestMissionStore.getState());
    expect(value).toBeNull();
  });

  it('ne casse pas quand sessionStorage est indisponible (SSR / node sans shim)', async () => {
    // Retire `window` AVANT l'import → `createJSONStorage` utilise le noop
    delete (globalThis as { window?: unknown }).window;
    vi.resetModules();

    const mod = await import('../src/lib/bitquest-mission-store');
    // Le store doit fonctionner en mémoire, juste sans persistance
    expect(() => mod.useBitquestMissionStore.getState().setMission(MISSION)).not.toThrow();
    expect(mod.useBitquestMissionStore.getState().mission).toEqual(MISSION);
  });
});
