/**
 * BitLab — Gestion des portefeuilles (2.1 du cahier des charges)
 * Génération de clés privées/publiques + adresses Legacy / SegWit / Taproot,
 * import WIF et phrases mnémoniques BIP39.
 *
 * SÉCURITÉ (protocole Zero-Knowledge) : ces fonctions s'exécutent exclusivement
 * dans le navigateur. Les clés privées ne sont JAMAIS transmises au serveur.
 */
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { p2pkh, p2wpkh, p2tr, WIF } from '@scure/btc-signer';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hex, uid } from './utils';
import { currentNet, pathForNetwork, signerNetwork, type NetId } from '../networks';
import { tSync } from '../i18n';

export type AddrType = 'legacy' | 'segwit' | 'taproot';

export interface TypeMeta {
  label: string;
  tech: string;
  bip: string;
  path: string;
  prefix: string;
  desc: string;
}

export const TYPE_INFO: Record<AddrType, TypeMeta> = {
  legacy: {
    label: 'Legacy',
    tech: 'P2PKH',
    bip: 'BIP-44',
    path: "m/44'/1'/0'/0/0",
    prefix: 'm… / n…',
    desc: 'Format historique Pay-to-Public-Key-Hash. Scripts les plus volumineux, frais les plus élevés.',
  },
  segwit: {
    label: 'SegWit',
    tech: 'P2WPKH',
    bip: 'BIP-84',
    path: "m/84'/1'/0'/0/0",
    prefix: 'tb1q…',
    desc: 'Native SegWit (bech32). Réduction d’environ 40 % des frais par rapport au Legacy.',
  },
  taproot: {
    label: 'Taproot',
    tech: 'P2TR',
    bip: 'BIP-86',
    path: "m/86'/1'/0'/0/0",
    prefix: 'tb1p…',
    desc: 'Schnorr + MAST : confidentialité des scripts et frais optimisés (bech32m).',
  },
};

/** Portefeuille de laboratoire (état local, persisté uniquement en IndexedDB). */
export interface LabWallet {
  id: string;
  label: string;
  type: AddrType;
  source: 'generated' | 'mnemonic' | 'wif';
  /** Réseau pour lequel le portefeuille a été dérivé (défaut historique : testnet4). */
  network?: NetId;
  mnemonic?: string;
  derivationPath?: string;
  privateKeyHex: string;
  wif: string;
  publicKeyHex: string;
  address: string;
  createdAt: number;
}

/** Extrait l'adresse d'un paiement @scure/btc-signer. Toujours définie pour une
 * entrée valide (clé publique compressée + paramètres de réseau corrects) ; lève
 * une erreur explicite sinon, au lieu d'un `!` qui propagerait un undefined. */
export function addrOf(p: { address?: string }): string {
  if (!p.address) throw new Error(tSync('Impossible de dériver l’adresse demandée (entrée invalide).'));
  return p.address;
}

/** Dérive la paire adresse/clé publique pour un type et un réseau donnés depuis la clé privée. */
export function deriveForType(
  privBytes: Uint8Array,
  type: AddrType,
  net: NetId = currentNet(),
): { address: string; publicKeyHex: string } {
  const pub = secp256k1.getPublicKey(privBytes, true); // 33 octets compressé
  const params = signerNetwork(net);
  let address: string;
  if (type === 'legacy') address = addrOf(p2pkh(pub, params));
  else if (type === 'segwit') address = addrOf(p2wpkh(pub, params));
  else address = addrOf(p2tr(pub.slice(1), undefined, params)); // Taproot : clé x-only 32 octets
  return { address, publicKeyHex: hex.encode(pub) };
}

function wifEncode(privBytes: Uint8Array, net: NetId = currentNet()): string {
  return WIF(signerNetwork(net)).encode(privBytes);
}

/** Génère un portefeuille complet avec phrase mnémonique (BIP39 + dérivation HD). */
export function createWallet(type: AddrType, words: 12 | 24 = 12, label?: string): LabWallet {
  const mnemonic = generateMnemonic(wordlist, words === 24 ? 256 : 128);
  return walletFromMnemonic(mnemonic, type, label, 'generated');
}

/** Construit un portefeuille depuis une phrase mnémonique BIP39 (réseau actif). */
export function walletFromMnemonic(
  mnemonic: string,
  type: AddrType,
  label?: string,
  source: LabWallet['source'] = 'mnemonic',
  net: NetId = currentNet(),
): LabWallet {
  const cleaned = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(cleaned, wordlist)) {
    throw new Error(tSync('Phrase mnémonique BIP39 invalide (mots inconnus ou checksum erroné).'));
  }
  const seed = mnemonicToSeedSync(cleaned);
  const path = pathForNetwork(TYPE_INFO[type].path, net);
  const hd = HDKey.fromMasterSeed(seed).derive(path);
  if (!hd.privateKey) throw new Error(tSync('Échec de la dérivation HD.'));
  const priv = hd.privateKey;
  const { address, publicKeyHex } = deriveForType(priv, type, net);
  return {
    id: uid('w'),
    label: label || `${TYPE_INFO[type].label} ${address.slice(0, 8)}…`,
    type,
    source,
    network: net,
    mnemonic: cleaned,
    derivationPath: path,
    privateKeyHex: hex.encode(priv),
    wif: wifEncode(priv, net),
    publicKeyHex,
    address,
    createdAt: Date.now(),
  };
}

/** Importe un portefeuille depuis une clé privée WIF (format du réseau actif). */
export function walletFromWif(wif: string, type: AddrType, label?: string, net: NetId = currentNet()): LabWallet {
  const cleaned = wif.trim();
  let priv: Uint8Array;
  try {
    priv = WIF(signerNetwork(net)).decode(cleaned);
  } catch {
    throw new Error(tSync('Clé WIF invalide ou incompatible avec le réseau sélectionné.'));
  }
  const { address, publicKeyHex } = deriveForType(priv, type, net);
  return {
    id: uid('w'),
    label: label || `${TYPE_INFO[type].label} ${address.slice(0, 8)}…`,
    type,
    source: 'wif',
    network: net,
    privateKeyHex: hex.encode(priv),
    wif: cleaned,
    publicKeyHex,
    address,
    createdAt: Date.now(),
  };
}

/** Vérifie la validité d'une phrase mnémonique sans lever d'exception. */
export function checkMnemonic(mnemonic: string): boolean {
  try {
    return validateMnemonic(mnemonic.trim().toLowerCase().replace(/\s+/g, ' '), wordlist);
  } catch {
    return false;
  }
}
