import type { NextRequest } from 'next/server';
import net from 'node:net';
import dns from 'node:dns';
import { createHash } from 'node:crypto';
import { getRegtestChain, persist } from '@/lib/regtest-engine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NetSpec {
  magic: Buffer;
  port: number;
  seeds: string[];
  fallbackIps: string[];
  minDiffBits: number | null;
}

const NETS: Record<string, NetSpec> = {
  testnet4: {
    magic: Buffer.from([0x1c, 0x16, 0x3f, 0x28]),
    port: 48333,
    seeds: ['seed.testnet4.bitcoin.sprovoost.nl', 'seed.testnet4.wiz.biz'],
    fallbackIps: ['13.213.16.163', '185.232.70.226', '216.230.225.61', '103.165.192.202'],
    minDiffBits: 0x1d00ffff,
  },
  regtest: {
    magic: Buffer.from([0xfa, 0xbf, 0xb5, 0xda]),
    port: Number(process.env.BITLAB_REGTEST_P2P_PORT ?? 18444),
    seeds: [],
    fallbackIps: [],
    minDiffBits: null,
  },
};

const REGTEST_HOST = process.env.BITLAB_REGTEST_P2P_HOST ?? '127.0.0.1';

const USER_AGENT = '/BitLab:0.1/';

const CONNECT_TIMEOUT_MS = 6_000;
const HANDSHAKE_TIMEOUT_MS = 8_000;
const POST_SEND_GRACE_MS = 3_000;
const MAX_PEERS = 3;

function checksum(payload: Buffer): Buffer {
  return createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);
}

function message(net: NetSpec, command: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(24);
  net.magic.copy(head, 0);
  head.write(command, 4, 'ascii');
  head.writeUInt32LE(payload.length, 16);
  checksum(payload).copy(head, 20);
  return Buffer.concat([head, payload]);
}

function versionPayload(): Buffer {
  const p = Buffer.alloc(85);
  let o = 0;
  p.writeInt32LE(70016, o);
  o += 4;
  p.writeBigUInt64LE(0n, o);
  o += 8;
  p.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), o);
  o += 8;
  p.writeBigUInt64LE(0n, o);
  o += 8;
  o += 10;
  p.writeUInt16BE(0xffff, o);
  o += 2;
  p.writeUInt8(127, o);
  o += 3;
  p.writeUInt8(1, o);
  o += 1;
  p.writeUInt16LE(0, o);
  o += 2;
  p.writeBigUInt64LE(0n, o);
  o += 8;
  o += 16;
  p.writeUInt16LE(0, o);
  o += 2;
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  p.writeBigUInt64LE(BigInt('0x' + nonce), o);
  o += 8;
  const ua = Buffer.from(USER_AGENT, 'ascii');
  const rest = Buffer.concat([
    Buffer.from([ua.length]),
    ua,
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0]),
  ]);
  return Buffer.concat([p.subarray(0, o), rest]);
}

interface ParsedMessage {
  command: string;
  payload: Buffer;
}

function parseMessages(net: NetSpec, buf: Buffer): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  let pos = 0;
  while (buf.length - pos >= 24) {
    if (!buf.subarray(pos, pos + 4).equals(net.magic)) {
      pos += 1;
      continue;
    }
    const length = buf.readUInt32LE(pos + 16);
    if (length > 4_000_000) break;
    if (buf.length - pos < 24 + length) break;
    const command = buf
      .subarray(pos + 4, pos + 16)
      .toString('ascii')
      .replace(/\0+$/, '');
    out.push({ command, payload: buf.subarray(pos + 24, pos + 24 + length) });
    pos += 24 + length;
  }
  return out;
}

function targetFromBits(bits: number): Buffer {
  const t = Buffer.alloc(32);
  const exponent = bits >>> 24;
  const mantissa = bits & 0x007f_ffff;
  for (let k = 0; k < 3; k++) {
    const pos = exponent - 3 + k;
    if (pos >= 0 && pos < 32) t[31 - pos] = (mantissa >> (8 * (2 - k))) & 0xff;
  }
  return t;
}

function validateBlockHex(
  blockHex: string,
  spec: NetSpec,
): { ok: true; block: Buffer } | { ok: false; reason: string } {
  if (!/^[0-9a-f]+$/i.test(blockHex) || blockHex.length % 2 !== 0) {
    return { ok: false, reason: 'bloc illisible (hex)' };
  }
  const block = Buffer.from(blockHex, 'hex');
  if (block.length < 80 + 60) {
    return { ok: false, reason: 'bloc trop court (en-tête + coinbase attendus)' };
  }
  if (block.length > 2_000_000) {
    return { ok: false, reason: 'bloc trop volumineux' };
  }
  const header = block.subarray(0, 80);
  const bits = header.readUInt32LE(72);
  if (spec.minDiffBits !== null && bits !== spec.minDiffBits) {
    return {
      ok: false,
      reason: `nBits ${bits.toString(16)} ≠ difficulté minimale — hors périmètre BitLab`,
    };
  }
  const time = header.readUInt32LE(68);
  const now = Math.floor(Date.now() / 1000);
  if (time < now - 7200 || time > now + 7200) {
    return { ok: false, reason: 'horodatage hors fenêtre ±2 h' };
  }
  if (header.subarray(4, 36).every((b) => b === 0)) {
    return { ok: false, reason: 'hash précédent nul' };
  }
  const digest = createHash('sha256').update(createHash('sha256').update(header).digest()).digest();
  const target = targetFromBits(bits);
  for (let i = 0; i < 32; i++) {
    const h = digest[31 - i];
    if (h < target[i]) break;
    if (h > target[i]) return { ok: false, reason: 'hash au-dessus de la cible — PoW insuffisant' };
  }
  return { ok: true, block };
}

async function resolvePeers(spec: NetSpec): Promise<string[]> {
  if (spec.seeds.length === 0) return [REGTEST_HOST];
  const resolver = new dns.promises.Resolver({ timeout: 4_000, tries: 1 });
  const results = await Promise.allSettled(spec.seeds.map((seed) => resolver.resolve4(seed)));
  const ips = new Set<string>();
  for (const r of results) if (r.status === 'fulfilled') r.value.forEach((ip) => ips.add(ip));
  for (const ip of spec.fallbackIps) ips.add(ip);
  return shufflePeers([...ips]);
}

function shufflePeers(items: string[]): string[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function submitToPeer(
  spec: NetSpec,
  ip: string,
  block: Buffer,
): Promise<'sent' | 'rejected' | 'error'> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port: spec.port });
    let buffer = Buffer.alloc(0);
    let done = false;
    let sent = false;

    const finish = (result: 'sent' | 'rejected' | 'error') => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish('error'));
    socket.on('error', () => finish('error'));

    socket.on('connect', () => {
      socket.write(message(spec, 'version', versionPayload()));
      socket.setTimeout(HANDSHAKE_TIMEOUT_MS);
    });

    socket.on('data', (chunk) => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
      buffer = Buffer.concat([buffer, bytes]);
      if (buffer.length > 1_000_000) return finish('error');
      const msgs = parseMessages(spec, buffer);
      const commands = msgs.map((m) => m.command);
      if (commands.includes('reject')) return finish('rejected');
      if (commands.includes('verack') && !sent) {
        socket.write(message(spec, 'verack', Buffer.alloc(0)));
        socket.write(message(spec, 'block', block));
        sent = true;
        socket.setTimeout(POST_SEND_GRACE_MS);
      }
      if (sent && commands.includes('getdata')) return finish('sent');
      if (sent) return finish('sent');
    });

    socket.on('timeout', () => finish(sent ? 'sent' : 'error'));
    socket.on('close', () => finish(sent ? 'sent' : 'error'));
  });
}

export async function POST(req: NextRequest) {
  let body: { net?: string; block?: string };
  try {
    body = (await req.json()) as { net?: string; block?: string };
  } catch {
    return Response.json({ ok: false, detail: 'corps JSON illisible' }, { status: 400 });
  }

  const spec = body.net ? NETS[body.net] : undefined;
  if (!spec) {
    return Response.json({ ok: false, detail: 'réseau non minable via BitLab' }, { status: 400 });
  }
  if (body.net === 'regtest' && !req.headers.get('x-regtest-cfg')) {
    const chain = await getRegtestChain();
    try {
      const mined = chain.connectRawBlock(String(body.block ?? ''));
      await persist(chain);
      return Response.json({
        ok: true,
        detail: `bloc accepté par la chaîne regtest embarquée (#${mined.height})`,
        height: mined.height,
        hash: mined.hash,
      });
    } catch (err) {
      return Response.json({ ok: false, detail: (err as Error).message }, { status: 400 });
    }
  }

  const check = validateBlockHex(String(body.block ?? ''), spec);
  if (!check.ok) {
    return Response.json({ ok: false, detail: check.reason }, { status: 400 });
  }

  const peers = await resolvePeers(spec);
  const maxPeers = spec.seeds.length === 0 ? 1 : MAX_PEERS;
  const reached: string[] = [];
  for (const ip of peers.slice(0, maxPeers + 3)) {
    if (reached.length >= maxPeers) break;
    const result = await submitToPeer(spec, ip, check.block);
    if (result === 'sent') reached.push(ip);
  }

  if (reached.length === 0) {
    return Response.json(
      {
        ok: false,
        detail:
          body.net === 'regtest'
            ? `nœud regtest injoignable sur ${REGTEST_HOST}:${spec.port} — Bitcoin Core est-il lancé (port P2P ouvert) ?`
            : 'aucun pair testnet4 joignable pour la diffusion',
      },
      { status: 502 },
    );
  }
  return Response.json({
    ok: true,
    peers: reached,
    detail: `bloc relayé vers ${reached.length} pair(s)`,
  });
}
