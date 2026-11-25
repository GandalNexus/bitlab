import type { LabWallet } from './keys';
import { decryptWithPassphrase, encryptWithPassphrase, isEncryptedBlob } from './crypto-at-rest';

/**
 * Lock / unlock d'un wallet (LOT 72).
 *
 * LOT 18 a livré la crypto AES-GCM via passphrase. LOT 20 a livré un
 * backup opt-in téléchargeable. Mais le wallet reste plaintext dans
 * IndexedDB.
 *
 * LOT 72 ajoute un mode « lock » : les champs sensibles (mnemonic,
 * WIF, privateKeyHex) sont chiffrés in-place dans l'objet persisted.
 * L'adresse + pubkey restent en clair pour que la UI puisse
 * afficher l'identité (QR, balance) sans unlock. Un unlock explicite
 * est requis pour toute opération qui signe (TX, mining).
 *
 * Shape persistée pour un wallet locked :
 *   { id, label, type, source, address, publicKeyHex, createdAt,
 *     locked: true, encryptedBlob: "1.salt.iv.ct" }
 * Shape normale :
 *   LabWallet standard (avec plaintext privateKeyHex/wif/mnemonic).
 */

/** Forme stockée d'un wallet verrouillé. */
export interface LockedWallet {
  id: string;
  label: string;
  type: LabWallet['type'];
  source: LabWallet['source'];
  network?: LabWallet['network'];
  derivationPath?: string;
  publicKeyHex: string;
  address: string;
  createdAt: number;
  locked: true;
  encryptedBlob: string;
}

/** Union discriminée entre wallet clair et verrouillé. */
export type AnyWallet = LabWallet | LockedWallet;

export function isLocked(w: AnyWallet): w is LockedWallet {
  return (w as LockedWallet).locked === true;
}

/**
 * Chiffre les secrets d'un wallet et retourne la forme verrouillée.
 * Les champs sensibles sont concaténés en JSON puis chiffrés en un
 * seul blob — plus simple à gérer que 3 blobs séparés.
 */
export async function lockWallet(wallet: LabWallet, passphrase: string): Promise<LockedWallet> {
  if (passphrase.length < 10) {
    throw new Error('Passphrase trop courte (≥ 10 caractères).');
  }
  const secrets = JSON.stringify({
    privateKeyHex: wallet.privateKeyHex,
    wif: wallet.wif,
    mnemonic: wallet.mnemonic ?? null,
  });
  const encryptedBlob = await encryptWithPassphrase(secrets, passphrase);
  return {
    id: wallet.id,
    label: wallet.label,
    type: wallet.type,
    source: wallet.source,
    network: wallet.network,
    derivationPath: wallet.derivationPath,
    publicKeyHex: wallet.publicKeyHex,
    address: wallet.address,
    createdAt: wallet.createdAt,
    locked: true,
    encryptedBlob,
  };
}

/**
 * Déchiffre un wallet verrouillé et retourne la forme plaintext.
 * Jette si passphrase incorrecte ou blob corrompu.
 *
 * ⚠️ Le résultat ne doit PAS être persisté dans l'IndexedDB — il
 * ne vit qu'en mémoire pour la durée d'une opération signante.
 */
export async function unlockWallet(locked: LockedWallet, passphrase: string): Promise<LabWallet> {
  if (!isEncryptedBlob(locked.encryptedBlob)) {
    throw new Error('Blob chiffré malformé.');
  }
  const plaintext = await decryptWithPassphrase(locked.encryptedBlob, passphrase);
  let parsed: { privateKeyHex: string; wif: string; mnemonic: string | null };
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('Secrets déchiffrés mais JSON malformé.');
  }
  return {
    id: locked.id,
    label: locked.label,
    type: locked.type,
    source: locked.source,
    network: locked.network,
    derivationPath: locked.derivationPath,
    privateKeyHex: parsed.privateKeyHex,
    wif: parsed.wif,
    publicKeyHex: locked.publicKeyHex,
    address: locked.address,
    createdAt: locked.createdAt,
    ...(parsed.mnemonic ? { mnemonic: parsed.mnemonic } : {}),
  };
}
