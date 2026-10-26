/**
 * BitLab — Moteur regtest embarqué : parseur/sérialiseur de transactions.
 *
 * Parseur Bitcoin minimal et strictement borné (aucune allocation folle,
 * bornes vérifiées à chaque lecture) : version, entrées (outpoint, scriptSig,
 * séquence), sorties (valeur, script), témoin SegWit, locktime. Fournit
 * txid (sérialisation legacy), wtxid, taille, poids et vsize, plus les
 * sérialisations utiles aux sighash (legacy et BIP 143).
 */
import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';

export interface ParsedTxIn {
  /** Hash de référence en ordre d'affichage (big-endian, hex minuscule). */
  txid: string;
  vout: number;
  sequence: number;
  scriptSig: Uint8Array;
}

export interface ParsedTxOut {
  valueSats: number;
  script: Uint8Array;
}

export interface ParsedTx {
  version: number;
  inputs: ParsedTxIn[];
  outputs: ParsedTxOut[];
  /** Témoin SegWit : witness[i] = pile de l'entrée i (vide si legacy). */
  witness: Uint8Array[][];
  locktime: number;
  isSegwit: boolean;
  isCoinbase: boolean;
  /** txid (double-SHA256 de la sérialisation legacy), ordre d'affichage. */
  txid: string;
  /** wtxid (incluant le témoin) — identique au txid pour une tx legacy. */
  wtxid: string;
  size: number;
  weight: number;
  vsize: number;
}

export class TxParseError extends Error {}

/* ─────────────────── Lecture bornée d'un tampon ─────────────────── */

class Reader {
  pos = 0;
  constructor(private readonly buf: Uint8Array) {}

  need(n: number): void {
    if (n < 0 || this.pos + n > this.buf.length) throw new TxParseError('transaction tronquée');
  }

  u8(): number {
    this.need(1);
    return this.buf[this.pos++];
  }

  u32le(): number {
    this.need(4);
    const v = this.buf[this.pos] | (this.buf[this.pos + 1] << 8) | (this.buf[this.pos + 2] << 16) | (this.buf[this.pos + 3] << 24);
    this.pos += 4;
    return v >>> 0;
  }

  u64le(): number {
    this.need(8);
    let v = 0;
    for (let i = 7; i >= 0; i--) v = v * 256 + this.buf[this.pos + i];
    this.pos += 8;
    return v;
  }

  bytes(n: number): Uint8Array {
    this.need(n);
    const out = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /** varint Bitcoin — plafonné pour éviter les allocations absurdes. */
  varint(max = 100_000): number {
    const first = this.u8();
    if (first < 0xfd) return first;
    const n = first === 0xfd ? this.u16le() : first === 0xfe ? this.u32le() : Number(this.u64le());
    if (!Number.isSafeInteger(n) || n > max) throw new TxParseError(`varint hors bornes (${n})`);
    return n;
  }

  private u16le(): number {
    this.need(2);
    const v = this.buf[this.pos] | (this.buf[this.pos + 1] << 8);
    this.pos += 2;
    return v;
  }
}

/* ─────────────────── Écriture varint / champs ─────────────────── */

export function writeVarint(n: number): number[] {
  if (n < 0xfd) return [n];
  if (n <= 0xffff) return [0xfd, n & 0xff, (n >>> 8) & 0xff];
  if (n <= 0xffff_ffff) return [0xfe, n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  throw new TxParseError('varint 8 octets non pris en charge');
}

export function u32leBytes(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

export function u64leBytes(n: number): number[] {
  if (n < 0 || !Number.isSafeInteger(n)) throw new TxParseError(`valeur invalide : ${n}`);
  const out: number[] = [];
  let v = n;
  for (let i = 0; i < 8; i++) {
    out.push(v & 0xff);
    v = Math.floor(v / 256);
  }
  return out;
}

/* ─────────────────── Parseur principal ─────────────────── */

const MAX_TX_BYTES = 1_000_000;

/**
 * Parse une transaction brute (octets). Lève TxParseError si invalide.
 * La transaction doit consommer la totalité du tampon.
 */
export function parseTx(raw: Uint8Array): ParsedTx {
  const { tx, end } = parseTxSlice(raw, 0);
  if (end !== raw.length) throw new TxParseError(`${raw.length - end} octets surnuméraires`);
  return tx;
}

/** Parse une tx à l'offset `offset` et retourne la fin exacte (blocs multi-tx). */
export function parseTxSlice(buf: Uint8Array, offset: number): { tx: ParsedTx; end: number } {
  const raw = buf.slice(offset);
  if (raw.length < 10 || raw.length > MAX_TX_BYTES) throw new TxParseError(`taille de transaction absurde (${raw.length})`);
  const r = new Reader(raw);
  const version = r.u32le();

  // Marqueur/flag SegWit : 0x00 0x01 (le marqueur 0x00 est impossible en
  // sérialisation legacy car le nombre d'entrées serait nul).
  let isSegwit = false;
  const save = r.pos;
  if (r.varint(1) === 0) {
    const flag = r.u8();
    if (flag !== 0x01) throw new TxParseError(`drapeau SegWit invalide (${flag})`);
    isSegwit = true;
  } else {
    r.pos = save;
  }

  const nIn = r.varint();
  if (nIn === 0) throw new TxParseError('aucune entrée');
  const inputs: ParsedTxIn[] = [];
  for (let i = 0; i < nIn; i++) {
    const ref = r.bytes(32);
    const vout = r.u32le();
    const scriptLen = r.varint(1_000_000);
    const scriptSig = r.bytes(scriptLen);
    const sequence = r.u32le();
    inputs.push({
      txid: hex.encode(ref.reverse()),
      vout,
      sequence,
      scriptSig,
    });
  }

  const nOut = r.varint();
  const outputs: ParsedTxOut[] = [];
  for (let i = 0; i < nOut; i++) {
    const valueSats = r.u64le();
    if (valueSats > 21_000_000 * 100_000_000) throw new TxParseError('valeur de sortie excédant la masse monétaire');
    const scriptLen = r.varint(1_000_000);
    outputs.push({ valueSats, script: r.bytes(scriptLen) });
  }

  const witness: Uint8Array[][] = inputs.map(() => []);
  if (isSegwit) {
    for (let i = 0; i < nIn; i++) {
      const nItems = r.varint(100);
      const items: Uint8Array[] = [];
      for (let j = 0; j < nItems; j++) {
        const len = r.varint(80_000);
        items.push(r.bytes(len));
      }
      witness[i] = items;
    }
  }

  const locktime = r.u32le();

  const isCoinbase = nIn === 1 && /^[0]{64}$/.test(inputs[0].txid) && inputs[0].vout === 0xffffffff;
  const stripped = serializeLegacy({ version, inputs, outputs, locktime });
  const txid = hex.encode(sha256(sha256(stripped)).reverse());
  const wtxid = isSegwit ? hex.encode(sha256(sha256(raw)).reverse()) : txid;
  const weight = stripped.length * 3 + raw.length;
  const tx: ParsedTx = {
    version,
    inputs,
    outputs,
    witness,
    locktime,
    isSegwit,
    isCoinbase,
    txid,
    wtxid,
    size: raw.length,
    weight,
    vsize: Math.ceil(weight / 4),
  };
  return { tx, end: offset + r.pos };
}

/** Sérialisation legacy (sans témoin) — base du txid et du sighash legacy. */
export function serializeLegacy(parts: {
  version: number;
  inputs: ParsedTxIn[];
  outputs: ParsedTxOut[];
  locktime: number;
  /** Surcharges par index (sighash legacy) — défaut : scriptSig réel. */
  scriptSigOverrides?: Map<number, Uint8Array>;
  sequenceOverrides?: Map<number, number>;
  /** Ajoute les 4 octets de nHashType (sighash legacy uniquement). */
  appendHashType?: number;
}): Uint8Array {
  const chunks: number[] = [];
  chunks.push(...u32leBytes(parts.version >>> 0));
  chunks.push(...writeVarint(parts.inputs.length));
  parts.inputs.forEach((inp, i) => {
    const ref = hex.decode(inp.txid).reverse();
    for (const b of ref) chunks.push(b);
    chunks.push(...u32leBytes(inp.vout >>> 0));
    const script = parts.scriptSigOverrides?.get(i) ?? inp.scriptSig;
    chunks.push(...writeVarint(script.length));
    for (const b of script) chunks.push(b);
    const seq = parts.sequenceOverrides?.get(i) ?? inp.sequence;
    chunks.push(...u32leBytes(seq >>> 0));
  });
  chunks.push(...writeVarint(parts.outputs.length));
  for (const out of parts.outputs) {
    chunks.push(...u64leBytes(out.valueSats));
    chunks.push(...writeVarint(out.script.length));
    for (const b of out.script) chunks.push(b);
  }
  chunks.push(...u32leBytes(parts.locktime >>> 0));
  if (parts.appendHashType !== undefined) chunks.push(...u32leBytes(parts.appendHashType >>> 0));
  return new Uint8Array(chunks);
}

/** Sérialisation complète (avec témoin si présent) — pour régénérer l'hex. */
export function serializeTx(tx: ParsedTx): Uint8Array {
  if (!tx.isSegwit) {
    return serializeLegacy({ version: tx.version, inputs: tx.inputs, outputs: tx.outputs, locktime: tx.locktime });
  }
  const chunks: number[] = [];
  chunks.push(...u32leBytes(tx.version >>> 0));
  chunks.push(0x00, 0x01); // marqueur + drapeau (détectés par le compteur d'entrées nul)
  chunks.push(...writeVarint(tx.inputs.length));
  for (const inp of tx.inputs) {
    for (const b of hex.decode(inp.txid).reverse()) chunks.push(b);
    chunks.push(...u32leBytes(inp.vout >>> 0));
    chunks.push(...writeVarint(inp.scriptSig.length));
    for (const b of inp.scriptSig) chunks.push(b);
    chunks.push(...u32leBytes(inp.sequence >>> 0));
  }
  chunks.push(...writeVarint(tx.outputs.length));
  for (const out of tx.outputs) {
    chunks.push(...u64leBytes(out.valueSats));
    chunks.push(...writeVarint(out.script.length));
    for (const b of out.script) chunks.push(b);
  }
  for (const items of tx.witness) {
    chunks.push(...writeVarint(items.length));
    for (const item of items) {
      chunks.push(...writeVarint(item.length));
      for (const b of item) chunks.push(b);
    }
  }
  chunks.push(...u32leBytes(tx.locktime >>> 0));
  return new Uint8Array(chunks);
}

/* ─────────────────── Merkle ─────────────────── */

/** Racine de Merkle d'une liste de txids (ordre d'affichage) — octets internes. */
export function merkleRoot(txids: string[]): Uint8Array {
  if (txids.length === 0) throw new TxParseError('merkle vide');
  let level: Uint8Array[] = txids.map((id) => hex.decode(id).reverse()); // ordre interne
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      const pair = new Uint8Array(64);
      pair.set(left, 0);
      pair.set(right, 32);
      next.push(sha256(sha256(pair)));
    }
    level = next;
  }
  return level[0];
}
