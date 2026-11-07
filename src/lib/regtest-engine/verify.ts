import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hash160, reverseHex } from './params';
import { serializeLegacy, u32leBytes, type ParsedTx } from './txparse';
import { schnorr } from '@noble/curves/secp256k1.js';

export type StandardKind = 'p2wpkh' | 'p2tr' | 'p2pkh' | 'other';

export function classifyScript(script: Uint8Array): StandardKind {
  if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) return 'p2wpkh';
  if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) return 'p2tr';
  if (
    script.length === 25 &&
    script[0] === 0x76 &&
    script[1] === 0xa9 &&
    script[22] === 0x88 &&
    script[24] === 0xac
  )
    return 'p2pkh';
  return 'other';
}

const SIGHASH_ALL = 0x01;

function splitHashType(sig: Uint8Array): { der: Uint8Array; hashType: number } | null {
  if (sig.length < 7) return null;
  const hashType = sig[sig.length - 1];
  if (hashType !== SIGHASH_ALL) return null;
  return { der: sig.slice(0, -1), hashType };
}

function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

<<<<<<< HEAD
export function bip143Sighash(tx: ParsedTx, inputIndex: number, prevAmountSats: number, scriptCode: Uint8Array): Uint8Array {
=======
/**
 * Préimage BIP 143 pour une entrée P2WPKH (scriptCode = 0x1976a914{pkh}88ac).
 * Les quatre hachages agrégés sont calculés intégralement à chaque appel :
 * en regtest les transactions sont minuscules, la simplicité prime.
 */
/** Exposé pour les tests de calibration (vecteur BIP 143 officiel). */
export function bip143Sighash(
  tx: ParsedTx,
  inputIndex: number,
  prevAmountSats: number,
  scriptCode: Uint8Array,
): Uint8Array {
>>>>>>> 92c54ba (style: prettier-format repo)
  const hashPrevouts = sha256d(
    concat(
      tx.inputs.map((i) =>
        concat([hex.decode(reverseHex(i.txid)), new Uint8Array(u32leBytes(i.vout >>> 0))]),
      ),
    ),
  );
  const hashSequence = sha256d(
    concat(tx.inputs.map((i) => new Uint8Array(u32leBytes(i.sequence)))),
  );
  const hashOutputs = sha256d(
    concat(
      tx.outputs.map((o) => {
        const out: number[] = [];
        let v = o.valueSats;
        for (let k = 0; k < 8; k++) {
          out.push(v & 0xff);
          v = Math.floor(v / 256);
        }
        const len = compactSizeBytes(o.script.length);
        for (const b of len) out.push(b);
        for (const b of o.script) out.push(b);
        return new Uint8Array(out);
      }),
    ),
  );

  const input = tx.inputs[inputIndex];
  const parts: Uint8Array[] = [
    new Uint8Array(u32leBytes(tx.version >>> 0)),
    hashPrevouts,
    hashSequence,
    hex.decode(reverseHex(input.txid)),
    new Uint8Array(u32leBytes(input.vout >>> 0)),
    new Uint8Array([scriptCode.length, ...scriptCode]),
    new Uint8Array(u64le(prevAmountSats)),
    new Uint8Array(u32leBytes(input.sequence >>> 0)),
    hashOutputs,
    new Uint8Array(u32leBytes(tx.locktime >>> 0)),
    new Uint8Array(u32leBytes(SIGHASH_ALL)),
  ];
  return sha256d(concat(parts));
}

function u64le(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (let i = 0; i < 8; i++) {
    out.push(v & 0xff);
    v = Math.floor(v / 256);
  }
  return out;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function derToCompact(der: Uint8Array): Uint8Array {
  return secp256k1.Signature.fromBytes(der, 'der').toBytes('compact');
}

function compactSizeBytes(n: number): Uint8Array {
  if (n < 253) return new Uint8Array([n]);
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >>> 8) & 0xff]);
  if (n <= 0xffffffff) {
    return new Uint8Array([0xfe, n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
  }
  const out = new Uint8Array(9);
  out[0] = 0xff;
  let v = n;
  for (let k = 1; k < 9; k++) {
    out[k] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return out;
}

function taggedHash(tag: string, msg: Uint8Array): Uint8Array {
  const t = sha256(new TextEncoder().encode(tag));
  return sha256(concat([t, t, msg]));
}

function bip341Sighash(
  tx: ParsedTx,
  inputIndex: number,
  prevAmounts: number[],
  prevScripts: Uint8Array[],
): Uint8Array {
  if (prevAmounts.length !== tx.inputs.length || prevScripts.length !== tx.inputs.length) {
    throw new Error('montants/scripts prevout requis pour toutes les entrées');
  }
  const shaPrevouts = sha256(
    concat(
      tx.inputs.map((i) =>
        concat([hex.decode(reverseHex(i.txid)), new Uint8Array(u32leBytes(i.vout >>> 0))]),
      ),
    ),
  );
  const shaAmounts = sha256(concat(prevAmounts.map((a) => new Uint8Array(u64le(a)))));
  const shaScripts = sha256(
    concat(prevScripts.map((s) => concat([compactSizeBytes(s.length), s]))),
  );
  const shaSequences = sha256(concat(tx.inputs.map((i) => new Uint8Array(u32leBytes(i.sequence)))));
  const shaOutputs = sha256(
    concat(
      tx.outputs.map((o) => {
        const out: number[] = [];
        let v = o.valueSats;
        for (let k = 0; k < 8; k++) {
          out.push(v & 0xff);
          v = Math.floor(v / 256);
        }
        const len = compactSizeBytes(o.script.length);
        for (const b of len) out.push(b);
        for (const b of o.script) out.push(b);
        return new Uint8Array(out);
      }),
    ),
  );

  const spendType = new Uint8Array([0x00]);
  const msg = concat([
    new Uint8Array([0x00]),
    new Uint8Array([0x00]),
    new Uint8Array(u32leBytes(tx.version >>> 0)),
    new Uint8Array(u32leBytes(tx.locktime >>> 0)),
    shaPrevouts,
    shaAmounts,
    shaScripts,
    shaSequences,
    shaOutputs,
    spendType,
    new Uint8Array(u32leBytes(inputIndex >>> 0)),
  ]);
  return taggedHash('TapSighash', msg);
}

function legacySighash(tx: ParsedTx, inputIndex: number, prevScript: Uint8Array): Uint8Array {
  const serialized = serializeLegacy({
    version: tx.version,
    inputs: tx.inputs,
    outputs: tx.outputs,
    locktime: tx.locktime,
    scriptSigOverrides: new Map(
      tx.inputs.map((_, i) => [i, i === inputIndex ? prevScript : new Uint8Array()]),
    ),
    appendHashType: SIGHASH_ALL,
  });
  return sha256d(serialized);
}

export interface VerifyPrevout {
  script: Uint8Array;
  valueSats: number;
}

export interface VerifyResult {
  ok: boolean;
  kind: StandardKind;
  reason?: string;
}

<<<<<<< HEAD
export function verifyInput(tx: ParsedTx, inputIndex: number, prevouts: VerifyPrevout[]): VerifyResult {
=======
/**
 * Vérifie les signatures de l'entrée `inputIndex` contre les prevouts de la
 * transaction. Le tableau `prevouts` doit couvrir TOUTES les entrées (BIP 341
 * agrège montants et scripts de toutes les entrées dans le sighash) ;
 * `prevouts[inputIndex]` est celui de l'entrée vérifiée.
 */
export function verifyInput(
  tx: ParsedTx,
  inputIndex: number,
  prevouts: VerifyPrevout[],
): VerifyResult {
>>>>>>> 92c54ba (style: prettier-format repo)
  const prevout = prevouts[inputIndex];
  if (!prevout) return { ok: false, kind: 'other', reason: 'prevout manquant' };
  const kind = classifyScript(prevout.script);
  if (kind === 'other') return { ok: true, kind };

  try {
    if (kind === 'p2wpkh') {
      const witness = tx.witness[inputIndex] ?? [];
      if (witness.length !== 2) return { ok: false, kind, reason: 'témoin P2WPKH incomplet' };
      const htype = splitHashType(witness[0]);
      if (!htype) return { ok: false, kind, reason: 'sighash non pris en charge ou DER invalide' };
      const pubkey = witness[1];
      if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
        return { ok: false, kind, reason: 'clé publique comprimée attendue' };
      }
      const pkh = hash160(pubkey);
      if (hex.encode(pkh) !== hex.encode(prevout.script.slice(2))) {
        return { ok: false, kind, reason: 'hash160(pubkey) ≠ hash du script' };
      }
      const scriptCode = new Uint8Array([0x76, 0xa9, 0x14, ...prevout.script.slice(2), 0x88, 0xac]);
      const msg = bip143Sighash(tx, inputIndex, prevout.valueSats, scriptCode);
      if (!secp256k1.verify(derToCompact(htype.der), msg, pubkey, { prehash: false })) {
        return { ok: false, kind, reason: 'signature ECDSA invalide (BIP 143)' };
      }
      return { ok: true, kind };
    }

    if (kind === 'p2tr') {
      const witness = tx.witness[inputIndex] ?? [];
      if (witness.length !== 1 || witness[0].length !== 64) {
        return { ok: false, kind, reason: 'dépense Taproot key-path ([sig64]) attendue' };
      }
      const msg = bip341Sighash(
        tx,
        inputIndex,
        prevouts.map((p) => p.valueSats),
        prevouts.map((p) => p.script),
      );
      if (!schnorr.verify(witness[0], msg, prevout.script.slice(2))) {
        return { ok: false, kind, reason: 'signature Schnorr invalide (BIP 341)' };
      }
      return { ok: true, kind };
    }

    const scriptSig = tx.inputs[inputIndex].scriptSig;
    const parsed = parseP2pkhScriptSig(scriptSig);
    if (!parsed) return { ok: false, kind, reason: 'scriptSig P2PKH illisible' };
    if (hex.encode(hash160(parsed.pubkey)) !== hex.encode(prevout.script.slice(3, 23))) {
      return { ok: false, kind, reason: 'hash160(pubkey) ≠ hash du script' };
    }
    const msg = legacySighash(tx, inputIndex, prevout.script);
    if (!secp256k1.verify(derToCompact(parsed.sigDer), msg, parsed.pubkey, { prehash: false })) {
      return { ok: false, kind, reason: 'signature ECDSA invalide (legacy)' };
    }
    return { ok: true, kind };
  } catch (err) {
    return { ok: false, kind, reason: `vérification : ${(err as Error).message}` };
  }
}

function parseP2pkhScriptSig(
  scriptSig: Uint8Array,
): { sigDer: Uint8Array; pubkey: Uint8Array } | null {
  try {
    if (scriptSig.length < 40 || scriptSig[0] < 9 || scriptSig[0] > 74) return null;
    const sigLen = scriptSig[0];
    const sigFull = scriptSig.slice(1, 1 + sigLen);
    const pubStart = 1 + sigLen;
    if (pubStart >= scriptSig.length) return null;
    const pubLen = scriptSig[pubStart];
    const pubkey = scriptSig.slice(pubStart + 1, pubStart + 1 + pubLen);
    if (pubkey.length !== pubLen || pubLen !== 33) return null;
    const htype = splitHashType(sigFull);
    if (!htype) return null;
    return { sigDer: htype.der, pubkey };
  } catch {
    return null;
  }
}
