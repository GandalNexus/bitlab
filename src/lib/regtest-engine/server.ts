import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { RegtestChain, type SerializedChain } from './chain';

const globalRef = globalThis as {
  __bitlabRegtestChain?: RegtestChain;
  __bitlabRegtestFlush?: Promise<void>;
  __bitlabRegtestReload?: Promise<RegtestChain>;
  __bitlabRegtestEpoch?: number;
  __bitlabRegtestBuiltAt?: number;
  __bitlabRegtestPid?: number;
};

// Tie the epoch to the process PID so it increments once per process start,
// not once per module evaluation. In Next.js dev mode each API route bundle
// re-evaluates this module independently — the old increment-on-every-eval
// pattern caused spurious cache busts that reloaded the chain singleton while
// a mutation was still in flight, producing stale UTXO reads and block height
// oscillations. With PID-anchoring, all bundles within the same process share
// the same epoch value and therefore share the same singleton.
if (globalRef.__bitlabRegtestPid !== process.pid) {
  globalRef.__bitlabRegtestPid = process.pid;
  globalRef.__bitlabRegtestEpoch = (globalRef.__bitlabRegtestEpoch ?? 0) + 1;
}

function dataFile(): string {
  const dir = process.env.BITLAB_DATA_DIR || join(process.cwd(), '.bitlab');
  return join(dir, 'regtest-chain.json');
}

async function load(): Promise<RegtestChain> {
  const file = dataFile();
  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw) as SerializedChain;
    return new RegtestChain(data);
  } catch {
    try {
      await fs.mkdir(dirname(file), { recursive: true });
    } catch {
      /* disk not writable — chain stays in memory */
    }
    return new RegtestChain();
  }
}

async function flushNow(chain: RegtestChain): Promise<void> {
  const file = dataFile();
  try {
    const dir = dirname(file);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(chain.serialize()), 'utf8');
    await fs.rename(tmp, file);
  } catch {
    /* persistence unavailable — session usable in memory */
  }
}

export async function getRegtestChain(): Promise<RegtestChain> {
  const epoch = globalRef.__bitlabRegtestEpoch ?? 0;
  const cached = globalRef.__bitlabRegtestChain;
  if (cached && globalRef.__bitlabRegtestBuiltAt === epoch) return cached;
  if (!globalRef.__bitlabRegtestReload) {
    globalRef.__bitlabRegtestReload = (async () => {
      // Flush the outgoing instance synchronously before loading a fresh one.
      // This ensures the reload picks up the latest mutations, not a stale
      // on-disk snapshot from a previous async write.
      if (cached) await flushNow(cached);
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

export async function persist(chain: RegtestChain): Promise<void> {
  if (globalRef.__bitlabRegtestChain !== chain) return;
  // Flush immediately on every mutation. The embedded chain mutates
  // infrequently (one tx or block per user action), so the debounce saving
  // is negligible. Immediate flushes prevent the next request from seeing
  // a stale on-disk snapshot if the singleton is ever reloaded.
  await flushNow(chain);
}

export async function flushRegtestChain(): Promise<void> {
  const chain = globalRef.__bitlabRegtestChain;
  if (!chain) return;
  await flushNow(chain);
}

export async function resetRegtestChain(): Promise<RegtestChain> {
  const fresh = new RegtestChain();
  globalRef.__bitlabRegtestChain = fresh;
  globalRef.__bitlabRegtestBuiltAt = globalRef.__bitlabRegtestEpoch ?? 0;
  await flushNow(fresh);
  return fresh;
}
