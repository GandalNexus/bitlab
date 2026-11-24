/**
 * Chiffrement at-rest des secrets wallet (TECHNICAL-DEBT.md §2).
 *
 * Objectif v1 : permettre de chiffrer mnemonic + WIF + privateKeyHex
 * avant de les écrire dans IndexedDB. Clé dérivée d'une passphrase
 * utilisateur via PBKDF2-HMAC-SHA256 (310 000 itérations, cf. OWASP
 * 2023), chiffrement symétrique via AES-GCM.
 *
 * Non-objectifs v1 :
 *   - Protection contre un attaquant qui a déjà exécution JS (XSS,
 *     malware) → une fois la passphrase saisie, la clé est en mémoire.
 *     Mitigation : TTL en mémoire, prompt re-saisie après N minutes.
 *   - WebAuthn / clé hardware → reporté LOT ultérieur.
 *   - Rotation de passphrase → requiert UI dédiée (déchiffrer avec
 *     ancienne puis rechiffrer avec nouvelle), prévue mais pas v1.
 *
 * Format binaire du blob chiffré (base64url concaténés, séparés par
 * `.`) : `<version>.<salt>.<iv>.<ciphertext>`
 *   - version : 1 octet (`1` pour PBKDF2-SHA256 310k + AES-GCM-256)
 *   - salt    : 16 octets random (PBKDF2)
 *   - iv      : 12 octets random (AES-GCM nonce)
 *   - ct      : ciphertext + tag 16 octets (format AES-GCM standard
 *               WebCrypto)
 */

const VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Base64url (sans padding) encode/decode. */
function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getSubtle(): Promise<SubtleCrypto> {
  // `crypto.subtle` est disponible dans tous les navigateurs modernes
  // ainsi qu'en Node 16+ (via `node:crypto` ou globalThis.crypto). Si
  // l'env en est dépourvu, on refuse de chiffrer plutôt que de produire
  // un ciphertext faible — sécurité fail-closed.
  const subtle = (globalThis.crypto ?? (await import("node:crypto")).webcrypto)
    .subtle;
  if (!subtle) {
    throw new Error("Web Crypto API indisponible — chiffrement impossible.");
  }
  return subtle;
}

async function deriveKey(
  subtle: SubtleCrypto,
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Chiffre une chaîne (mnemonic / WIF / hex) avec une passphrase.
 * Retourne un blob encodé base64url prêt à être stocké en IndexedDB.
 * Jette si la passphrase est vide ou si Web Crypto est absent.
 */
export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string,
): Promise<string> {
  if (passphrase.length === 0) {
    throw new Error("Passphrase vide — refus de chiffrer.");
  }
  const subtle = await getSubtle();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(subtle, passphrase, salt);
  const ct = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return [
    VERSION.toString(),
    b64urlEncode(salt),
    b64urlEncode(iv),
    b64urlEncode(ct),
  ].join(".");
}

/**
 * Déchiffre un blob produit par `encryptWithPassphrase`.
 * Jette si la passphrase est incorrecte, le blob est corrompu, ou la
 * version n'est pas supportée.
 */
export async function decryptWithPassphrase(
  blob: string,
  passphrase: string,
): Promise<string> {
  if (passphrase.length === 0) {
    throw new Error("Passphrase vide — refus de déchiffrer.");
  }
  const parts = blob.split(".");
  if (parts.length !== 4) {
    throw new Error("Blob chiffré malformé (version.salt.iv.ciphertext).");
  }
  const version = Number.parseInt(parts[0], 10);
  if (!Number.isFinite(version) || version !== VERSION) {
    throw new Error(`Version ${parts[0]} non supportée (attendu ${VERSION}).`);
  }
  const salt = b64urlDecode(parts[1]);
  const iv = b64urlDecode(parts[2]);
  const ct = b64urlDecode(parts[3]);
  const subtle = await getSubtle();
  const key = await deriveKey(subtle, passphrase, salt);
  try {
    const pt = new Uint8Array(
      await subtle.decrypt(
        { name: "AES-GCM", iv: iv as unknown as BufferSource },
        key,
        ct as unknown as BufferSource,
      ),
    );
    return new TextDecoder().decode(pt);
  } catch {
    // AES-GCM invalide le tag si clé incorrecte ou ciphertext altéré.
    // On relance une erreur stable pour l'UI (évite de leak de détails).
    throw new Error("Déchiffrement échoué — passphrase incorrecte ou blob altéré.");
  }
}

/**
 * Détecte si une string ressemble à un blob chiffré v1 (sans tenter
 * de déchiffrer). Utile pour migrer les wallets historiques en clair.
 */
export function isEncryptedBlob(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.startsWith(`${VERSION}.`)) return false;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((p) => p.length > 0);
}
