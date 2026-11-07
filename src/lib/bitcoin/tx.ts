import { Transaction, OutScript, Address, multisig as multisigTpl } from '@scure/btc-signer';
import { bech32, bech32m } from '@scure/base';
import { concatBytes } from '@noble/hashes/utils.js';
import {
  hex,
  RX,
  b58checkEncode,
  addressP2PKH,
  addressP2SH,
  addressSegWitV0,
  addressTaproot,
} from './utils';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { addrOf, type AddrType } from './keys';
import { currentNet, NETWORKS, REGTEST_NETWORK, signerNetwork, type NetId } from '../networks';
import { tSync } from '../i18n';

export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status?: { confirmed: boolean; block_height?: number };
  isCoinbase?: boolean;
}

export interface TxOutputDraft {
  address: string;
  amountSats: number;
}

export interface BuildResult {
  hex: string;
  txid: string;
  feeSats: number;
  vsize: number;
  changeSats: number;
}

export function addressToScript(address: string, net: NetId = currentNet()): Uint8Array {
  const value = Address(signerNetwork(net)).decode(address);
  return OutScript.encode(value);
}

const IN_VSIZE: Record<string, number> = { legacy: 149, segwit: 68.75, taproot: 58 };
<<<<<<< HEAD
const OUT_VSIZE: Record<string, number> = { legacy: 34, p2sh: 32, segwit: 31, p2wsh: 43, taproot: 43, op_return: 43 };
=======
/** Tailles virtuelles moyennes par type de sortie (vB). */
const OUT_VSIZE: Record<string, number> = {
  legacy: 34,
  p2sh: 32,
  segwit: 31,
  taproot: 43,
  op_return: 43,
};
>>>>>>> 92c54ba (style: prettier-format repo)
const TX_HEADER_VSIZE = 10.5;

export function inVsizeOf(type: AddrType): number {
  return IN_VSIZE[type] ?? 148;
}

export function outVsizeOf(address: string): number {
  try {
    const script = addressToScript(address);
    const t = detectScriptType(script);
    if (t === 'segwit') {
      return script.length === 22 ? OUT_VSIZE.segwit : OUT_VSIZE.p2wsh;
    }
    return OUT_VSIZE[t] ?? 34;
  } catch {
    return 34;
  }
}

export const DUST_LIMIT = 546;

export function estimateVsize(
  inType: AddrType,
  nInputs: number,
  outputs: TxOutputDraft[],
  hasChange: boolean,
  changeAddress?: string,
): number {
  let v = TX_HEADER_VSIZE + nInputs * inVsizeOf(inType);
  for (const o of outputs) v += outVsizeOf(o.address);
  if (hasChange) v += changeAddress ? outVsizeOf(changeAddress) : OUT_VSIZE.segwit;
  return v;
}

export function draftTx(params: {
  utxos: Utxo[];
  inputAddress: string;
  inputType: AddrType;
  outputs: TxOutputDraft[];
  changeAddress?: string;
  changeSats?: number;
  tapInternalKeyHex?: string;
}): Transaction {
  const { utxos, inputAddress, inputType, outputs, changeAddress, changeSats } = params;
  if (utxos.length === 0) throw new Error(tSync('Aucun UTXO sélectionné.'));
  for (const o of outputs) {
    if (!RX.btcAddress.test(o.address))
      throw new Error(tSync('Adresse de sortie invalide : {a}', { a: o.address }));
    if (!Number.isInteger(o.amountSats) || o.amountSats <= 0)
      throw new Error(tSync('Montant de sortie invalide (sats entiers requis).'));
    if (o.amountSats < DUST_LIMIT)
      throw new Error(
        tSync('Montant inférieur à la limite de poussière ({n} sats).', { n: DUST_LIMIT }),
      );
  }

  const prevScript = addressToScript(inputAddress);
  const tx = new Transaction({ allowLegacyWitnessUtxo: true });
  for (const u of utxos) {
    if (!RX.txid.test(u.txid)) throw new Error(tSync('TXID d’UTXO invalide.'));
    if (inputType === 'legacy') {
<<<<<<< HEAD
      tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script: prevScript, amount: BigInt(u.value) } });
=======
      // Entrée Legacy P2PKH : script de dépense précédent + montant.
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: { script: prevScript, amount: BigInt(u.value) },
      });
>>>>>>> 92c54ba (style: prettier-format repo)
    } else if (inputType === 'taproot') {
      if (!params.tapInternalKeyHex) throw new Error(tSync('Clé interne Taproot manquante.'));
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: { script: prevScript, amount: BigInt(u.value) },
        tapInternalKey: hex.decode(params.tapInternalKeyHex),
      });
    } else {
<<<<<<< HEAD
      tx.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script: prevScript, amount: BigInt(u.value) } });
=======
      // Entrée SegWit v0 : témoin + montant requis (BIP-143).
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: { script: prevScript, amount: BigInt(u.value) },
      });
>>>>>>> 92c54ba (style: prettier-format repo)
    }
  }
  const netParams = signerNetwork();
  const netCfg = NETWORKS[currentNet()];
  const addOut = (address: string, sats: bigint, kind: 'sortie' | 'change') => {
    try {
      tx.addOutputAddress(address, sats, netParams);
    } catch {
      const fr =
        kind === 'sortie'
          ? 'Adresse de sortie « {a} » invalide pour le réseau {net} — format attendu : {hint}'
          : 'Adresse de monnaie restante « {a} » invalide pour le réseau {net} — format attendu : {hint}';
      throw new Error(tSync(fr, { a: address, net: netCfg.label, hint: netCfg.addressHint }));
    }
  };
  for (const o of outputs) addOut(o.address, BigInt(o.amountSats), 'sortie');
  if (changeSats !== undefined && changeAddress && changeSats >= DUST_LIMIT) {
    addOut(changeAddress, BigInt(changeSats), 'change');
  }
  return tx;
}

export function buildSignedTx(params: {
  utxos: Utxo[];
  outputs: TxOutputDraft[];
  feeRateSatVb: number;
  changeAddress: string;
  privateKeyHex: string;
  inputAddress: string;
  inputType: AddrType;
}): BuildResult {
  const { utxos, outputs, feeRateSatVb, changeAddress, privateKeyHex, inputAddress, inputType } =
    params;
  if (outputs.length === 0) throw new Error(tSync('Au moins une sortie est requise.'));

  const totalIn = utxos.reduce((s, u) => s + u.value, 0);
  const totalOut = outputs.reduce((s, o) => s + o.amountSats, 0);
  if (totalOut >= totalIn)
    throw new Error(tSync('Le total des sorties dépasse le total des UTXO sélectionnés.'));

  const estVsize = estimateVsize(
    inputType,
    utxos.length,
    outputs,
    true,
    changeAddress || undefined,
  );
  const feeEst = Math.ceil(estVsize * feeRateSatVb);
  const change = totalIn - totalOut - feeEst;
  const hasChange = change >= DUST_LIMIT;

  const xOnlyKey = secp256k1.getPublicKey(hex.decode(privateKeyHex), true).slice(1);
  const tx = draftTx({
    utxos,
    inputAddress,
    inputType,
    outputs,
    changeAddress,
    changeSats: hasChange ? change : undefined,
    tapInternalKeyHex: inputType === 'taproot' ? hex.encode(xOnlyKey) : undefined,
  });

  tx.sign(hex.decode(privateKeyHex));
  tx.finalize();

  const feeSats = Number(tx.fee);
  const lastOut = tx.outputsLength > 0 ? tx.getOutput(tx.outputsLength - 1) : undefined;
  return {
    hex: tx.hex,
    txid: tx.id,
    feeSats,
    vsize: tx.vsize,
    changeSats: hasChange && lastOut ? Number(lastOut.amount) : 0,
  };
}

export function detectScriptType(
  script: Uint8Array,
): 'legacy' | 'p2sh' | 'segwit' | 'taproot' | 'op_return' | 'unknown' {
  if (script.length === 0) return 'unknown';
  if (script[0] === 0x6a) return 'op_return';
  if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) return 'segwit';
  if (script.length === 34 && script[0] === 0x00 && script[1] === 0x20) return 'segwit';
  if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) return 'taproot';
  if (
    script.length === 25 &&
    script[0] === 0x76 &&
    script[1] === 0xa9 &&
    script[23] === 0x88 &&
    script[24] === 0xac
  )
    return 'legacy';
  if (script.length === 23 && script[0] === 0xa9 && script[22] === 0x87) return 'p2sh';
  return 'unknown';
}

export interface DecodedOut {
  index: number;
  valueSats: number;
  address?: string;
  type: string;
  scriptHex: string;
  opReturnText?: string;
}

export interface DecodedIn {
  index: number;
  txid: string;
  vout: number;
  scriptSigHex: string;
  witness: string[];
}

export interface DecodedTx {
  txid: string;
  version: number;
  locktime: number;
  sizeBytes: number;
  vsize: number;
  isSigned: boolean;
  inputs: DecodedIn[];
  outputs: DecodedOut[];
}

export function scriptToAddress(script: Uint8Array): string | undefined {
  const t = detectScriptType(script);
  try {
    if (t === 'legacy') return addressP2PKH(script.slice(3, 23));
    if (t === 'p2sh') return addressP2SH(script.slice(2, 22));
    if (t === 'segwit') return addressSegWitV0(script.slice(2));
    if (t === 'taproot') return addressTaproot(script.slice(2));
  } catch {
    return undefined;
  }
  return undefined;
}

export function scriptToAddressOn(script: Uint8Array, net: NetId): string | undefined {
  const t = detectScriptType(script);
  const hrp = net === 'mainnet' ? 'bc' : net === 'regtest' ? REGTEST_NETWORK.bech32 : 'tb';
  const p2pkhVersion = net === 'mainnet' ? 0x00 : 0x6f;
  const p2shVersion = net === 'mainnet' ? 0x05 : 0xc4;
  try {
    if (t === 'legacy')
      return b58checkEncode(concatBytes(new Uint8Array([p2pkhVersion]), script.slice(3, 23)));
    if (t === 'p2sh')
      return b58checkEncode(concatBytes(new Uint8Array([p2shVersion]), script.slice(2, 22)));
    if (t === 'segwit') return bech32.encode(hrp, [0, ...bech32.toWords(script.slice(2))]);
    if (t === 'taproot') return bech32m.encode(hrp, [1, ...bech32m.toWords(script.slice(2))]);
  } catch {
    return undefined;
  }
  return undefined;
}

export function decodeRawTx(rawHex: string, net: NetId = currentNet()): DecodedTx {
  const cleaned = rawHex.trim().replace(/\s+/g, '');
  if (!RX.hex.test(cleaned) || cleaned.length < 20)
    throw new Error(tSync('Hexadécimal de transaction invalide.'));
  const bytes = hex.decode(cleaned);
  const tx = Transaction.fromRaw(bytes, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
    unknown: 'ignore',
  });
  const inputs: DecodedIn[] = Array.from({ length: tx.inputsLength }, (_, i) => {
    const inp = tx.getInput(i);
    return {
      index: i,
      txid:
        typeof inp.txid === 'string'
          ? inp.txid
          : inp.txid instanceof Uint8Array
            ? hex.encode(inp.txid)
            : '',
      vout: inp.index ?? 0,
      scriptSigHex: inp.finalScriptSig ? hex.encode(inp.finalScriptSig) : '',
      witness: inp.finalScriptWitness ? inp.finalScriptWitness.map((w) => hex.encode(w)) : [],
    };
  });
  const outputs: DecodedOut[] = Array.from({ length: tx.outputsLength }, (_, i) => {
    const out = tx.getOutput(i);
    const script = out.script ?? new Uint8Array();
    const t = detectScriptType(script);
    let opReturnText: string | undefined;
    if (t === 'op_return') {
      try {
        opReturnText = new TextDecoder().decode(script.slice(2));
      } catch {
        opReturnText = undefined;
      }
    }
    return {
      index: i,
      valueSats: Number(out.amount ?? 0n),
      address: scriptToAddressOn(script, net),
      type: t,
      scriptHex: hex.encode(script),
      opReturnText,
    };
  });
  return {
    txid: tx.id,
    version: tx.version,
    locktime: tx.lockTime,
    sizeBytes: bytes.length,
    vsize: tx.vsize,
    isSigned: tx.isFinal,
    inputs,
    outputs,
  };
}

export interface MultisigResult {
  address: string;
  scriptHex: string;
  witnessScriptHex: string;
  m: number;
  n: number;
}

export function createMultisig(pubkeysHex: string[], m: number): MultisigResult {
  if (pubkeysHex.length < 2)
    throw new Error(tSync('Le multisig nécessite au moins 2 clés publiques.'));
  if (m < 1 || m > pubkeysHex.length)
    throw new Error(tSync('Seuil m invalide (1 ≤ m ≤ {n}).', { n: pubkeysHex.length }));
  const pubs = pubkeysHex.map((p) => {
    const c = p.trim().toLowerCase().replace(/\s+/g, '');
    if (!RX.hex.test(c) || ![66, 130].includes(c.length))
      throw new Error(tSync('Clé publique invalide (hex compressé 33 octets attendu).'));
    return hex.decode(c);
  });
  const tpl = multisigTpl(m, pubs, true, true, signerNetwork());
  return {
    address: addrOf(tpl),
    scriptHex: hex.encode(tpl.script),
    witnessScriptHex: hex.encode(tpl.witnessScript ?? tpl.script),
    m,
    n: pubs.length,
  };
}
