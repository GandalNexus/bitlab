import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { Address, OutScript, Transaction } from '@scure/btc-signer';
import { REGTEST_NETWORK } from '../networks';
import { bip34Script, compactBitsToTarget } from '../mining/core';
import {
  blockSubsidy,
  hash160,
  minRelayFee,
  COINBASE_MATURITY,
  FAUCET_DEFAULT_SATS,
  FAUCET_MAX_SATS,
  FAUCET_PREMINE_BLOCKS,
  MAX_BLOCK_WEIGHT,
  MAX_FUTURE_TIME_SEC,
  MAX_INDEXED_ADDRESSES,
  MAX_MEMPOOL_TXS,
  MAX_RETAINED_BLOCKS,
  MAX_STD_TX_WEIGHT,
  REGTEST_BITS,
  REGTEST_GENESIS_HASH,
  REGTEST_GENESIS_HEADER_HEX,
  REGTEST_GENESIS_TX_HEX,
} from './params';
import {
  merkleRoot,
  parseTx,
  parseTxSlice,
  u32leBytes,
  u64leBytes,
  writeVarint,
  TxParseError,
  type ParsedTx,
} from './txparse';
import { verifyInput, type VerifyPrevout } from './verify';

export interface BlockRecord {
  hash: string;
  headerHex: string;
  height: number;
  time: number;
  txids: string[];
  raw: string | null;
}

export interface TxRecord {
  txid: string;
  hex: string;
  blockHash: string | null;
  height: number | null;
  time: number;
  feeSats: number | null;
  size: number;
  weight: number;
  vsize: number;
  isCoinbase: boolean;
}

interface Utxo {
  valueSats: number;
  script: string;
  height: number;
  isCoinbase: boolean;
}

export interface MinedBlock {
  hash: string;
  height: number;
  txCount: number;
  subsidySats: number;
  feeSats: number;
}

export class ChainError extends Error {}

export interface SerializedChain {
  version: 1;
  faucet: { privHex: string; scriptHex: string };
  blocks: BlockRecord[];
  txs: TxRecord[];
  utxos: { key: string; valueSats: number; script: string; height: number; isCoinbase: boolean }[];
  mempool: TxRecord[];
}

export function addressToScriptBcrt(address: string): Uint8Array {
  const decoded = Address(REGTEST_NETWORK).decode(address.trim());
  return OutScript.encode(decoded);
}

export function scriptToAddressBcrt(script: Uint8Array): string | undefined {
  try {
    const decoded = OutScript.decode(script);
    if (decoded.type === 'unknown') return undefined;
    return Address(REGTEST_NETWORK).encode(decoded);
  } catch {
    return undefined;
  }
}

const GENESIS_TXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

function headerTime(headerHex: string): number {
  const b = hex.decode(headerHex);
  return b[68] | (b[69] << 8) | (b[70] << 16) | (b[71] << 24);
}

function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function meetsTarget(digest: Uint8Array, target: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (digest[i] < target[i]) return true;
    if (digest[i] > target[i]) return false;
  }
  return true;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function buildCoinbaseTx(
  height: number,
  scriptSig: Uint8Array,
  valueSats: number,
  payoutScript: Uint8Array,
): string {
  const chunks: number[] = [];
  chunks.push(...u32leBytes(2));
  chunks.push(0x01);
  for (let i = 0; i < 32; i++) chunks.push(0x00);
  chunks.push(...u32leBytes(0xffffffff));
  chunks.push(...writeVarint(scriptSig.length));
  for (const b of scriptSig) chunks.push(b);
  chunks.push(...u32leBytes(0xffffffff));
  chunks.push(0x01);
  chunks.push(...u64leBytes(valueSats));
  chunks.push(...writeVarint(payoutScript.length));
  for (const b of payoutScript) chunks.push(b);
  chunks.push(...u32leBytes(0));
  return hex.encode(new Uint8Array(chunks));
}

export class RegtestChain {
  private blocks = new Map<string, BlockRecord>();
  private heightHash: string[] = [];
  private txs = new Map<string, TxRecord>();
  private utxos = new Map<string, Utxo>();
  private scriptUtxos = new Map<string, Set<string>>();
  private addrTxs = new Map<string, string[]>();
  private mempool = new Map<string, TxRecord>();
  private mempoolSpends = new Map<string, string>();

  private faucetPrivHex!: string;
  private faucetScriptHex!: string;

  constructor(data?: SerializedChain) {
    if (data) {
      this.hydrate(data);
      return;
    }
    this.faucetPrivHex = hex.encode(crypto.getRandomValues(new Uint8Array(32)));
    this.faucetScriptHex = hex.encode(this.faucetScript());
    this.installGenesis();
    this.mineTo(null, FAUCET_PREMINE_BLOCKS);
  }

  private faucetScript(): Uint8Array {
    const pub = secp256k1.getPublicKey(hex.decode(this.faucetPrivHex), true);
    return new Uint8Array([0x00, 0x14, ...hash160(pub)]);
  }

  faucetAddress(): string {
    return scriptToAddressBcrt(this.faucetScript()) ?? '';
  }

  private installGenesis(): void {
    this.blocks.set(REGTEST_GENESIS_HASH, {
      hash: REGTEST_GENESIS_HASH,
      headerHex: REGTEST_GENESIS_HEADER_HEX,
      height: 0,
      time: headerTime(REGTEST_GENESIS_HEADER_HEX),
      txids: [GENESIS_TXID],
      raw: null,
    });
    this.heightHash.push(REGTEST_GENESIS_HASH);
    this.txs.set(GENESIS_TXID, {
      txid: GENESIS_TXID,
      hex: REGTEST_GENESIS_TX_HEX,
      blockHash: REGTEST_GENESIS_HASH,
      height: 0,
      time: headerTime(REGTEST_GENESIS_HEADER_HEX),
      feeSats: 0,
      size: REGTEST_GENESIS_TX_HEX.length / 2,
      weight: (REGTEST_GENESIS_TX_HEX.length / 2) * 4,
      vsize: REGTEST_GENESIS_TX_HEX.length / 2,
      isCoinbase: true,
    });
  }

  tipHeight(): number {
    return this.heightHash.length - 1;
  }

  tipHash(): string {
    return this.heightHash[this.heightHash.length - 1];
  }

  tipTime(): number {
    const tip = this.blocks.get(this.tipHash());
    if (!tip) throw new ChainError('état interne incohérent : tip absent');
    return tip.time;
  }

  blockAt(height: number): BlockRecord | null {
    const hash = this.heightHash[height];
    return hash ? (this.blocks.get(hash) ?? null) : null;
  }

  blockByHash(hash: string): BlockRecord | null {
    return this.blocks.get(hash.toLowerCase()) ?? null;
  }

  blockHashAtHeight(height: number): string | null {
    return this.heightHash[height] ?? null;
  }

  headerHexByHash(hash: string): string | null {
    return this.blocks.get(hash.toLowerCase())?.headerHex ?? null;
  }

  rawBlockByHash(hash: string): string | null {
    return this.blocks.get(hash.toLowerCase())?.raw ?? null;
  }

  consensusBlockByHash(hash: string): string | null {
    const rec = this.blocks.get(hash.toLowerCase());
    if (!rec || rec.raw === null) return null;
    const bytes = hex.decode(rec.raw);
    if (bytes.length < 80) return null;
    let count = 0;
    let off = 80;
    while (off < bytes.length) {
      const { end } = parseTxSlice(bytes, off);
      count += 1;
      off = end;
    }
    return hex.encode(
      concatBytes(bytes.slice(0, 80), new Uint8Array(writeVarint(count)), bytes.slice(80)),
    );
  }

  recentBlocks(
    n = 10,
  ): { id: string; height: number; timestamp: number; tx_count: number; size: number }[] {
    const out: { id: string; height: number; timestamp: number; tx_count: number; size: number }[] =
      [];
    for (let h = this.tipHeight(); h >= 1 && out.length < n; h--) {
      const b = this.blockAt(h);
      if (!b) continue;
      let size = 80;
      for (const id of b.txids) size += this.txs.get(id)?.size ?? 0;
      out.push({ id: b.hash, height: b.height, timestamp: b.time, tx_count: b.txids.length, size });
    }
    return out;
  }

  mempoolStats(): { count: number; vsize: number; total_fee: number } {
    let vsize = 0;
    let totalFee = 0;
    for (const tx of this.mempool.values()) {
      vsize += tx.vsize;
      totalFee += tx.feeSats ?? 0;
    }
    return { count: this.mempool.size, vsize, total_fee: totalFee };
  }

  mempoolRecent(): { txid: string; fee: number; vsize: number; value: number }[] {
    return [...this.mempool.values()]
      .sort((a, b) => (b.feeSats ?? 0) - (a.feeSats ?? 0))
      .slice(0, 50)
      .map((tx) => ({
        txid: tx.txid,
        fee: tx.feeSats ?? 0,
        vsize: tx.vsize,
        value: this.txValue(tx),
      }));
  }

  private txValue(rec: TxRecord): number {
    if (!rec.hex) return 0;
    try {
      return parseTx(hex.decode(rec.hex)).outputs.reduce((s, o) => s + o.valueSats, 0);
    } catch {
      return 0;
    }
  }

  txByTxid(txid: string): TxRecord | null {
    const id = txid.toLowerCase();
    return this.txs.get(id) ?? this.mempool.get(id) ?? null;
  }

  txHex(txid: string): string | null {
    const rec = this.txByTxid(txid);
    return rec?.hex || null;
  }

  txInfo(txid: string): unknown {
    const rec = this.txByTxid(txid);
    if (!rec || !rec.hex) return null;
    let parsed: ParsedTx;
    try {
      parsed = parseTx(hex.decode(rec.hex));
    } catch {
      return null;
    }
    const confirmed = rec.height !== null;
    const block = confirmed ? this.blocks.get(rec.blockHash ?? '') : null;
    return {
      txid: rec.txid,
      version: parsed.version,
      locktime: parsed.locktime,
      vin: parsed.inputs.map((inp, i) => {
        const prevout = this.outputOf(inp.txid, inp.vout);
        return {
          txid: inp.txid,
          vout: inp.vout,
          is_coinbase: i === 0 && parsed.isCoinbase,
          sequence: inp.sequence,
          ...(prevout
            ? {
                prevout: {
                  scriptpubkey: prevout.script,
                  scriptpubkey_address: scriptToAddressBcrt(hex.decode(prevout.script)),
                  value: prevout.valueSats,
                },
              }
            : {}),
        };
      }),
      vout: parsed.outputs.map((o) => ({
        scriptpubkey: hex.encode(o.script),
        scriptpubkey_address: scriptToAddressBcrt(o.script),
        value: o.valueSats,
      })),
      size: rec.size,
      weight: rec.weight,
      fee: rec.feeSats ?? undefined,
      status: confirmed
        ? {
            confirmed: true,
            block_height: rec.height ?? undefined,
            block_hash: rec.blockHash ?? undefined,
            block_time: block?.time,
          }
        : { confirmed: false },
    };
  }

  private outputOf(txid: string, vout: number): { script: string; valueSats: number } | null {
    const utxo = this.utxos.get(`${txid}:${vout}`);
    if (utxo) return { script: utxo.script, valueSats: utxo.valueSats };
    const rec = this.txs.get(txid);
    if (!rec?.hex) return null;
    try {
      const tx = parseTx(hex.decode(rec.hex));
      const out = tx.outputs[vout];
      if (!out) return null;
      return { script: hex.encode(out.script), valueSats: out.valueSats };
    } catch {
      return null;
    }
  }

  addressInfo(address: string): {
    address: string;
    chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
    mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
  } {
    const scriptHex = hex.encode(addressToScriptBcrt(address));
    const txids = this.addrTxs.get(scriptHex) ?? [];
    let funded = 0;
    let spent = 0;
    for (const txid of txids) {
      const rec = this.txs.get(txid);
      if (!rec?.hex) continue;
      let parsed: ParsedTx;
      try {
        parsed = parseTx(hex.decode(rec.hex));
      } catch {
        continue;
      }
      if (rec.height === null) continue;
      for (const out of parsed.outputs) {
        if (hex.encode(out.script) === scriptHex) funded += out.valueSats;
      }
      for (const inp of parsed.inputs) {
        const prev = this.outputOf(inp.txid, inp.vout);
        if (prev?.script === scriptHex) spent += prev.valueSats;
      }
    }
    let mempoolCount = 0;
    for (const id of txids) if (this.mempool.has(id) && !this.txs.has(id)) mempoolCount += 1;
    return {
      address,
      chain_stats: { funded_txo_sum: funded, spent_txo_sum: spent, tx_count: txids.length },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: mempoolCount },
    };
  }

  addressUtxos(address: string): {
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean; block_height?: number };
    isCoinbase?: boolean;
  }[] {
    const scriptHex = hex.encode(addressToScriptBcrt(address));
    const out: {
      txid: string;
      vout: number;
      value: number;
      status: { confirmed: boolean; block_height?: number };
      isCoinbase?: boolean;
    }[] = [];
    for (const op of this.scriptUtxos.get(scriptHex) ?? []) {
      const u = this.utxos.get(op);
      if (!u) continue;
      const sep = op.lastIndexOf(':');
      const txid = op.slice(0, sep);
      const vout = Number(op.slice(sep + 1));
      out.push({
        txid,
        vout,
        value: u.valueSats,
        status: u.height > 0 ? { confirmed: true, block_height: u.height } : { confirmed: false },
        isCoinbase: u.isCoinbase,
      });
    }
    return out;
  }

  addressTxs(address: string): unknown[] {
    const scriptHex = hex.encode(addressToScriptBcrt(address));
    const txids = this.addrTxs.get(scriptHex) ?? [];
    const out: unknown[] = [];
    for (const id of txids) {
      const info = this.txInfo(id);
      if (info) out.push(info);
    }
    return out.reverse();
  }

  faucetBalance(): { matureSats: number; immatureSats: number } {
    let mature = 0;
    let immature = 0;
    const spendHeight = this.tipHeight() + 1;
    for (const op of this.scriptUtxos.get(this.faucetScriptHex) ?? []) {
      const u = this.utxos.get(op);
      if (!u) continue;
      if (u.isCoinbase && spendHeight - u.height < COINBASE_MATURITY) immature += u.valueSats;
      else mature += u.valueSats;
    }
    return { matureSats: mature, immatureSats: immature };
  }

  faucetSend(
    address: string,
    sats = FAUCET_DEFAULT_SATS,
  ): {
    txid: string;
    feeSats: number;
    blockHash: string;
    blockHeight: number;
    poolSats: number;
  } {
    const amount = Math.floor(sats);
    if (!Number.isInteger(amount) || amount <= 0) throw new ChainError('montant invalide');
    if (amount > FAUCET_MAX_SATS) {
      throw new ChainError(
        `montant plafonné à ${Math.floor(FAUCET_MAX_SATS / 1e8)} BTC de test par distribution`,
      );
    }
    const destScript = addressToScriptBcrt(address);
    const spendHeight = this.tipHeight() + 1;

    const candidates: { key: string; value: number }[] = [];
    for (const op of this.scriptUtxos.get(this.faucetScriptHex) ?? []) {
      const u = this.utxos.get(op);
      if (!u) continue;
      if (u.isCoinbase && spendHeight - u.height < COINBASE_MATURITY) continue;
      candidates.push({ key: op, value: u.valueSats });
    }
    candidates.sort((a, b) => b.value - a.value);
    const feeEstimate = 2_500;
    const picked: { key: string; value: number }[] = [];
    let totalIn = 0;
    for (const c of candidates) {
      if (totalIn >= amount + feeEstimate) break;
      picked.push(c);
      totalIn += c.value;
    }
    if (totalIn < amount + feeEstimate) {
      throw new ChainError(
        'pool faucet insuffisant — minez des blocs supplémentaires (onglet Mineur)',
      );
    }

    const faucetScript = hex.decode(this.faucetScriptHex);
    const tx = new Transaction();
    for (const p of picked) {
      const sep = p.key.lastIndexOf(':');
      tx.addInput({
        txid: p.key.slice(0, sep),
        index: Number(p.key.slice(sep + 1)),
        witnessUtxo: { script: faucetScript, amount: BigInt(p.value) },
      });
    }
    tx.addOutput({ script: destScript, amount: BigInt(amount) });
    const change = totalIn - amount - feeEstimate;
    if (change > 546) tx.addOutput({ script: faucetScript, amount: BigInt(change) });
    tx.sign(hex.decode(this.faucetPrivHex));
    tx.finalize();

    const { txid } = this.acceptTx(tx.hex);
    const feeSats = Number(tx.fee ?? feeEstimate);
    const mined = this.mineTo(null, 1);
    return {
      txid,
      feeSats,
      blockHash: mined[0].hash,
      blockHeight: mined[0].height,
      poolSats: this.faucetBalance().matureSats,
    };
  }

  acceptTx(rawHex: string): { txid: string; feeSats: number; vsize: number } {
    const clean = rawHex.trim().toLowerCase();
    let parsed: ParsedTx;
    try {
      parsed = parseTx(hex.decode(clean));
    } catch (err) {
      if (err instanceof TxParseError)
        throw new ChainError(`transaction illisible : ${err.message}`);
      throw err;
    }
    if (parsed.isCoinbase)
      throw new ChainError('une coinbase ne peut pas être diffusée comme transaction');
    if (this.txs.has(parsed.txid) || this.mempool.has(parsed.txid)) {
      throw new ChainError('transaction déjà connue');
    }
    if (parsed.weight > MAX_STD_TX_WEIGHT)
      throw new ChainError(`poids ${parsed.weight} > norme standard ${MAX_STD_TX_WEIGHT}`);

    const feeSats = this.validateTxInputs(parsed, this.tipHeight() + 1, null, 'mempool');

    this.mempool.set(parsed.txid, {
      txid: parsed.txid,
      hex: clean,
      blockHash: null,
      height: null,
      time: Math.floor(Date.now() / 1000),
      feeSats,
      size: parsed.size,
      weight: parsed.weight,
      vsize: parsed.vsize,
      isCoinbase: false,
    });
    for (const inp of parsed.inputs) {
      this.mempoolSpends.set(`${inp.txid}:${inp.vout}`, parsed.txid);
    }
    for (const out of parsed.outputs) this.indexAddr(hex.encode(out.script), parsed.txid);
    this.evictMempool();
    return { txid: parsed.txid, feeSats, vsize: parsed.vsize };
  }

  private evictMempool(): void {
    while (this.mempool.size > MAX_MEMPOOL_TXS) {
      let lowest: string | null = null;
      let lowestFee = Infinity;
      for (const [id, tx] of this.mempool) {
        const fee = tx.feeSats ?? 0;
        if (fee < lowestFee) {
          lowestFee = fee;
          lowest = id;
        }
      }
      if (lowest === null) break;
      this.dropMempoolTx(lowest);
    }
  }

  private dropMempoolTx(txid: string): void {
    const rec = this.mempool.get(txid);
    if (!rec) return;
    this.mempool.delete(txid);
    try {
      const parsed = parseTx(hex.decode(rec.hex));
      for (const inp of parsed.inputs) {
        const op = `${inp.txid}:${inp.vout}`;
        if (this.mempoolSpends.get(op) === txid) this.mempoolSpends.delete(op);
      }
    } catch {}
  }

  private validateTxInputs(
    tx: ParsedTx,
    spendHeight: number,
    spentInBlock: Set<string> | null,
    mode: 'mempool' | 'block',
    evict?: Set<string>,
  ): number {
    let totalIn = 0;
    const prevouts: VerifyPrevout[] = [];
    for (let i = 0; i < tx.inputs.length; i++) {
      const inp = tx.inputs[i];
      const op = `${inp.txid}:${inp.vout}`;
      const utxo = this.utxos.get(op);
      if (!utxo) {
        if (spentInBlock?.has(op)) throw new ChainError(`double-dépense intra-bloc (entrée ${i})`);
        throw new ChainError(`entrée ${i} (${inp.txid.slice(0, 10)}…) inconnue ou déjà dépensée`);
      }
      const mempoolOwner = this.mempoolSpends.get(op);
      if (mempoolOwner !== undefined && mempoolOwner !== tx.txid) {
        if (mode === 'mempool') throw new ChainError(`double-dépense mempool (entrée ${i})`);
        evict?.add(mempoolOwner);
      }
      if (spentInBlock?.has(op)) throw new ChainError(`double-dépense intra-bloc (entrée ${i})`);
      if (utxo.isCoinbase && spendHeight - utxo.height < COINBASE_MATURITY) {
        const wait = COINBASE_MATURITY - (spendHeight - utxo.height);
        throw new ChainError(
          `coinbase immature — encore ${Math.max(1, wait)} bloc(s) avant dépense`,
        );
      }
      prevouts.push({ script: hex.decode(utxo.script), valueSats: utxo.valueSats });
      totalIn += utxo.valueSats;
      spentInBlock?.add(op);
    }
    for (let i = 0; i < tx.inputs.length; i++) {
      const verdict = verifyInput(tx, i, prevouts);
      if (!verdict.ok)
        throw new ChainError(`entrée ${i} refusée : ${verdict.reason ?? 'signature invalide'}`);
    }
    const totalOut = tx.outputs.reduce((s, o) => s + o.valueSats, 0);
    if (totalOut > totalIn)
      throw new ChainError(`sorties (${totalOut}) supérieures aux entrées (${totalIn})`);
    const fee = totalIn - totalOut;
    const minFee = minRelayFee(tx.weight);
    if (fee < minFee)
      throw new ChainError(`frais insuffisants (${fee} < ${minFee} sats — min-relay 1 sat/vB)`);
    return fee;
  }

  mineTo(payScript: Uint8Array | null, n: number): MinedBlock[] {
    const count = Math.max(1, Math.min(5_000, Math.floor(n)));
    const payout = payScript ?? this.faucetScript();
    const mined: MinedBlock[] = [];
    for (let i = 0; i < count; i++) {
      mined.push(this.mineOne(payout));
    }
    return mined;
  }

  private mineOne(payout: Uint8Array): MinedBlock {
    const height = this.tipHeight() + 1;

    const byRate = [...this.mempool.values()].sort(
      (a, b) => (b.feeSats ?? 0) / b.weight - (a.feeSats ?? 0) / a.weight,
    );
    const packed: TxRecord[] = [];
    let packedWeight = 0;
    let packedFee = 0;
    for (const rec of byRate) {
      if (packedWeight + rec.weight > MAX_BLOCK_WEIGHT - 4_000) break;
      packed.push(rec);
      packedWeight += rec.weight;
      packedFee += rec.feeSats ?? 0;
    }

    const subsidy = blockSubsidy(height);
    const tag = new Uint8Array([
      ...new TextEncoder().encode('/BitLab/'),
      ...crypto.getRandomValues(new Uint8Array(8)),
    ]);
    const coinbaseHex = buildCoinbaseTx(
      height,
      new Uint8Array([...bip34Script(height), ...tag]),
      subsidy + packedFee,
      payout,
    );

    const prevInternal = hex.decode(this.tipHash()).reverse();
    const merkle = merkleRoot([txIdOfHex(coinbaseHex), ...packed.map((p) => p.txid)]);
    const time = Math.max(this.tipTime() + 1, Math.floor(Date.now() / 1000));
    const header = new Uint8Array(80);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x2000_0000, true);
    header.set(prevInternal, 4);
    header.set(merkle, 36);
    view.setUint32(68, time, true);
    view.setUint32(72, REGTEST_BITS, true);
    const target = compactBitsToTarget(REGTEST_BITS);
    let nonce = 0;
    for (; nonce < 0xffff_ffff; nonce++) {
      view.setUint32(76, nonce, true);
      if (meetsTarget(sha256d(header), target)) break;
    }
    if (nonce >= 0xffff_ffff)
      throw new ChainError('aucun nonce trouvé (impossible à difficulté 1)');
    const headerHex = hex.encode(header);
    const hash = hex.encode(sha256d(header).reverse());

    return this.connectValidatedBlock(headerHex, hash, [coinbaseHex, ...packed.map((p) => p.hex)]);
  }

  connectRawBlock(blockHex: string): MinedBlock {
    const bytes = hex.decode(blockHex.trim().toLowerCase());
    if (bytes.length < 80 + 60)
      throw new ChainError('bloc trop court (en-tête + coinbase attendus)');
    if (bytes.length > 4_000_000) throw new ChainError('bloc trop volumineux');

    const txHexes: string[] = [];
    let off = 80;
    while (off < bytes.length) {
      try {
        const { end } = parseTxSlice(bytes, off);
        txHexes.push(hex.encode(bytes.slice(off, end)));
        off = end;
      } catch (err) {
        if (err instanceof TxParseError) {
          throw new ChainError(`transaction n°${txHexes.length} illisible : ${err.message}`);
        }
        throw err;
      }
    }

    const header = bytes.slice(0, 80);
    const hash = hex.encode(sha256d(header).reverse());
    return this.connectValidatedBlock(hex.encode(header), hash, txHexes);
  }

  private connectValidatedBlock(headerHex: string, hash: string, txHexes: string[]): MinedBlock {
    if (this.blocks.has(hash)) throw new ChainError('bloc déjà connu');
    const header = hex.decode(headerHex);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const height = this.tipHeight() + 1;

    const prevDisplay = hex.encode(header.slice(4, 36).reverse());
    if (prevDisplay !== this.tipHash()) {
      throw new ChainError('hash précédent ≠ tip courant (branche orpheline refusée)');
    }
    const bits = view.getUint32(72, true);
    if (bits !== REGTEST_BITS)
      throw new ChainError(`nBits ${bits.toString(16)} ≠ difficulté regtest`);
    if (!meetsTarget(sha256d(header), compactBitsToTarget(bits))) {
      throw new ChainError('hash au-dessus de la cible — PoW insuffisante');
    }

    const time = view.getUint32(68, true);
    if (time > Math.floor(Date.now() / 1000) + MAX_FUTURE_TIME_SEC) {
      throw new ChainError('horodatage trop loin dans le futur');
    }
    const lastTimes: number[] = [];
    for (let h = Math.max(0, this.tipHeight() - 10); h <= this.tipHeight(); h++) {
      const prev = this.blockAt(h);
      if (!prev) throw new ChainError('état interne incohérent : historique de blocs troué');
      lastTimes.push(prev.time);
    }
    if (time <= median(lastTimes))
      throw new ChainError('horodatage ≤ médiane MTP des 11 derniers blocs');

    if (txHexes.length === 0) throw new ChainError('bloc sans transaction');
    const parsedTxs: ParsedTx[] = txHexes.map((h) => {
      try {
        return parseTx(hex.decode(h));
      } catch (err) {
        if (err instanceof TxParseError)
          throw new ChainError(`bloc contient une transaction illisible : ${err.message}`);
        throw err;
      }
    });
    if (!parsedTxs[0].isCoinbase) throw new ChainError('première transaction ≠ coinbase');
    for (let i = 1; i < parsedTxs.length; i++) {
      if (parsedTxs[i].isCoinbase) throw new ChainError(`coinbase supplémentaire en position ${i}`);
    }

    if (hex.encode(merkleRoot(parsedTxs.map((t) => t.txid))) !== hex.encode(header.slice(36, 68))) {
      throw new ChainError('racine de Merkle ≠ champ de l’en-tête');
    }

    const heightPush = bip34Script(height);
    const scriptSig = parsedTxs[0].inputs[0].scriptSig;
    if (scriptSig.length < heightPush.length)
      throw new ChainError('scriptSig coinbase trop court (BIP 34)');
    for (let i = 0; i < heightPush.length; i++) {
      if (scriptSig[i] !== heightPush[i])
        throw new ChainError('préfixe BIP 34 absent de la coinbase');
    }

    const spentInBlock = new Set<string>();
    const evict = new Set<string>();
    const fees: number[] = [0];
    for (let i = 1; i < parsedTxs.length; i++) {
      if (parsedTxs[i].weight > MAX_STD_TX_WEIGHT)
        throw new ChainError(`tx ${i} : poids hors norme`);
      fees.push(this.validateTxInputs(parsedTxs[i], height, spentInBlock, 'block', evict));
    }
    let feesTotal = 0;
    for (let i = 1; i < fees.length; i++) feesTotal += fees[i];

    let payout = 0;
    for (const out of parsedTxs[0].outputs) payout += out.valueSats;
    const subsidy = blockSubsidy(height);
    if (payout > subsidy + feesTotal) {
      throw new ChainError(
        `coinbase excessive (${payout} > subvention ${subsidy} + frais ${feesTotal})`,
      );
    }

    this.blocks.set(hash, {
      hash,
      headerHex,
      height,
      time,
      txids: parsedTxs.map((t) => t.txid),
      raw: hex.encode(concatBytes(header, ...txHexes.map((h) => hex.decode(h)))),
    });
    this.heightHash.push(hash);

    for (let i = 0; i < parsedTxs.length; i++) {
      const tx = parsedTxs[i];
      if (i > 0) {
        for (const inp of tx.inputs) {
          const op = `${inp.txid}:${inp.vout}`;
          const utxo = this.utxos.get(op);
          if (utxo) {
            this.scriptUtxos.get(utxo.script)?.delete(op);
            this.utxos.delete(op);
            this.indexAddr(utxo.script, tx.txid);
          }
        }
      }
      for (let v = 0; v < tx.outputs.length; v++) {
        const out = tx.outputs[v];
        const scriptHex = hex.encode(out.script);
        this.utxos.set(`${tx.txid}:${v}`, {
          valueSats: out.valueSats,
          script: scriptHex,
          height,
          isCoinbase: i === 0,
        });
        let set = this.scriptUtxos.get(scriptHex);
        if (!set) {
          set = new Set();
          this.scriptUtxos.set(scriptHex, set);
        }
        set.add(`${tx.txid}:${v}`);
        this.indexAddr(scriptHex, tx.txid);
      }
      this.txs.set(tx.txid, {
        txid: tx.txid,
        hex: txHexes[i],
        blockHash: hash,
        height,
        time,
        feeSats: i === 0 ? 0 : (this.mempool.get(tx.txid)?.feeSats ?? fees[i]),
        size: tx.size,
        weight: tx.weight,
        vsize: tx.vsize,
        isCoinbase: i === 0,
      });
    }

    for (const tx of parsedTxs.slice(1)) this.dropMempoolTx(tx.txid);
    for (const id of evict) this.dropMempoolTx(id);

    this.prune();

    return { hash, height, txCount: parsedTxs.length, subsidySats: subsidy, feeSats: feesTotal };
  }

  private indexAddr(scriptHex: string, txid: string): void {
    let list = this.addrTxs.get(scriptHex);
    if (!list) {
      if (this.addrTxs.size >= MAX_INDEXED_ADDRESSES) return;
      list = [];
      this.addrTxs.set(scriptHex, list);
    }
    if (!list.includes(txid)) list.push(txid);
  }

  private prune(): void {
    const floorHeight = this.tipHeight() - MAX_RETAINED_BLOCKS;
    if (floorHeight <= 0) return;
    for (let h = 1; h <= floorHeight; h++) {
      const rec = this.blockAt(h);
      if (!rec || rec.raw === null) continue;
      rec.raw = null;
      for (const txid of rec.txids) {
        const t = this.txs.get(txid);
        if (!t?.hex) continue;
        try {
          const parsed = parseTx(hex.decode(t.hex));
          const stillUnspent = parsed.outputs.some((_, v) => this.utxos.has(`${txid}:${v}`));
          if (!stillUnspent) t.hex = '';
        } catch {
          t.hex = '';
        }
      }
    }
  }

  info(): {
    height: number;
    tipHash: string;
    tipTime: number;
    subsidyNextSats: number;
    halvingInBlocks: number;
    mempoolCount: number;
    faucet: { address: string; matureSats: number; immatureSats: number };
    genesisHash: string;
  } {
    const height = this.tipHeight();
    const bal = this.faucetBalance();
    return {
      height,
      tipHash: this.tipHash(),
      tipTime: this.tipTime(),
      subsidyNextSats: blockSubsidy(height + 1),
      halvingInBlocks: 150 - (height % 150),
      mempoolCount: this.mempool.size,
      faucet: {
        address: this.faucetAddress(),
        matureSats: bal.matureSats,
        immatureSats: bal.immatureSats,
      },
      genesisHash: REGTEST_GENESIS_HASH,
    };
  }

  serialize(): SerializedChain {
    return {
      version: 1,
      faucet: { privHex: this.faucetPrivHex, scriptHex: this.faucetScriptHex },
      blocks: [...this.blocks.values()],
      txs: [...this.txs.values()],
      utxos: [...this.utxos.entries()].map(([key, u]) => ({ key, ...u })),
      mempool: [...this.mempool.values()],
    };
  }

  private hydrate(data: SerializedChain): void {
    if (data.version !== 1)
      throw new Error(`sérialisation inconnue v${String((data as { version?: number }).version)}`);
    this.faucetPrivHex = data.faucet.privHex;
    this.faucetScriptHex = data.faucet.scriptHex;
    for (const b of data.blocks) this.blocks.set(b.hash, b);
    this.heightHash = data.blocks.map((b) => b.hash);
    for (const t of data.txs) this.txs.set(t.txid, t);
    for (const u of data.utxos) {
      this.utxos.set(u.key, {
        valueSats: u.valueSats,
        script: u.script,
        height: u.height,
        isCoinbase: u.isCoinbase,
      });
      let set = this.scriptUtxos.get(u.script);
      if (!set) {
        set = new Set();
        this.scriptUtxos.set(u.script, set);
      }
      set.add(u.key);
    }
    // Rebuild addrTxs for all confirmed transactions.
    // This index is not serialized to disk — it must be derived from txs on
    // every load, otherwise addressInfo() returns funded_txo_sum=0 after
    // a server restart and the wallet balance shows 0.
    for (const t of data.txs) {
      if (t.height === null || !t.hex) continue;
      try {
        const parsed = parseTx(hex.decode(t.hex));
        // Index outputs — the receiving script.
        for (const out of parsed.outputs) {
          this.indexAddr(hex.encode(out.script), t.txid);
        }
        // Index inputs — the spending script (looked up from the UTXO set,
        // which is already fully restored at this point).
        if (!t.isCoinbase) {
          for (const inp of parsed.inputs) {
            const spentScript = this.utxos.get(`${inp.txid}:${inp.vout}`)?.script;
            // If the UTXO was already spent and removed, fall back to txs.
            const fallback = (() => {
              if (spentScript) return spentScript;
              const prev = this.txs.get(inp.txid);
              if (!prev?.hex) return null;
              try {
                return hex.encode(
                  parseTx(hex.decode(prev.hex)).outputs[inp.vout]?.script ?? new Uint8Array(),
                );
              } catch {
                return null;
              }
            })();
            if (fallback) this.indexAddr(fallback, t.txid);
          }
        }
      } catch {
        // Unparseable tx (pruned hex) — skip; the UTXO set is the ground truth.
      }
    }
    for (const m of data.mempool) {
      this.mempool.set(m.txid, m);
      try {
        const parsed = parseTx(hex.decode(m.hex));
        for (const inp of parsed.inputs) this.mempoolSpends.set(`${inp.txid}:${inp.vout}`, m.txid);
        for (const out of parsed.outputs) this.indexAddr(hex.encode(out.script), m.txid);
      } catch {}
    }
  }
}

function txIdOfHex(txHex: string): string {
  return parseTx(hex.decode(txHex)).txid;
}
