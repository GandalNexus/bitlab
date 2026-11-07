import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { RegtestChain, type SerializedChain } from './chain';

const FLUSH_DELAY_MS = 400;

const globalRef = globalThis as {
  __bitlabRegtestChain?: RegtestChain;
  __bitlabRegtestTimer?: ReturnType<typeof setTimeout>;
  __bitlabRegtestFlush?: Promise<void>;
  __bitlabRegtestReload?: Promise<RegtestChain>;
  __bitlabRegtestEpoch?: number;
  __bitlabRegtestBuiltAt?: number;
};

globalRef.__bitlabRegtestEpoch = (globalRef.__bitlabRegtestEpoch ?? 0) + 1;

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
    } catch {}
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
  } catch {}
}

function scheduleFlush(chain: RegtestChain): void {
  if (globalRef.__bitlabRegtestTimer) clearTimeout(globalRef.__bitlabRegtestTimer);
  globalRef.__bitlabRegtestTimer = setTimeout(() => {
    if (globalRef.__bitlabRegtestChain !== chain) return;
    globalRef.__bitlabRegtestTimer = undefined;
    globalRef.__bitlabRegtestFlush = flushNow(chain).finally(() => {
      globalRef.__bitlabRegtestFlush = undefined;
    });
  }, FLUSH_DELAY_MS);
  if (
    typeof globalRef.__bitlabRegtestTimer === 'object' &&
    'unref' in globalRef.__bitlabRegtestTimer
  ) {
    (globalRef.__bitlabRegtestTimer as { unref(): void }).unref();
  }
}

export async function getRegtestChain(): Promise<RegtestChain> {
  const epoch = globalRef.__bitlabRegtestEpoch ?? 0;
  const cached = globalRef.__bitlabRegtestChain;
  if (cached && globalRef.__bitlabRegtestBuiltAt === epoch) return cached;
  if (!globalRef.__bitlabRegtestReload) {
    globalRef.__bitlabRegtestReload = (async () => {
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
  scheduleFlush(chain);
}

export async function flushRegtestChain(): Promise<void> {
  const chain = globalRef.__bitlabRegtestChain;
  if (!chain) return;
  if (globalRef.__bitlabRegtestFlush) await globalRef.__bitlabRegtestFlush;
  await flushNow(chain);
}

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
