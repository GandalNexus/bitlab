import { describe, expect, it } from "vitest";
import {
  decryptWithPassphrase,
  encryptWithPassphrase,
  isEncryptedBlob,
} from "../src/lib/bitcoin/crypto-at-rest";

const MNEMONIC_12 =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";
const WIF = "cUeKHd5orzT3mUc7uJDZUJmFmYy92z6fbdcBNqWRfJ8CyGNNVi9Y";
const HEX = "c4bbcb1fbec99d65bf59d85c8cb62ee2db963f0fe106f483d9afa73bd4e39a8a";

describe("encryptWithPassphrase / decryptWithPassphrase", () => {
  it("roundtrip ASCII — déchiffre exactement la plaintext", async () => {
    const blob = await encryptWithPassphrase(MNEMONIC_12, "correct horse battery staple");
    const out = await decryptWithPassphrase(blob, "correct horse battery staple");
    expect(out).toBe(MNEMONIC_12);
  });

  it("roundtrip WIF", async () => {
    const blob = await encryptWithPassphrase(WIF, "s3cret!");
    expect(await decryptWithPassphrase(blob, "s3cret!")).toBe(WIF);
  });

  it("roundtrip hex privateKey", async () => {
    const blob = await encryptWithPassphrase(HEX, "another passphrase 42");
    expect(await decryptWithPassphrase(blob, "another passphrase 42")).toBe(HEX);
  });

  it("roundtrip emoji + unicode (NFC)", async () => {
    const text = "🔑 Satoshi · Côté secret · 日本語";
    const blob = await encryptWithPassphrase(text, "pw-utf8");
    expect(await decryptWithPassphrase(blob, "pw-utf8")).toBe(text);
  });

  it("deux chiffrements successifs produisent des blobs différents (IV random)", async () => {
    const a = await encryptWithPassphrase(MNEMONIC_12, "pw");
    const b = await encryptWithPassphrase(MNEMONIC_12, "pw");
    expect(a).not.toBe(b);
    // Mais tous deux déchiffrent vers la même plaintext.
    expect(await decryptWithPassphrase(a, "pw")).toBe(MNEMONIC_12);
    expect(await decryptWithPassphrase(b, "pw")).toBe(MNEMONIC_12);
  });

  it("mauvaise passphrase → erreur stable (pas de leak)", async () => {
    const blob = await encryptWithPassphrase(MNEMONIC_12, "right");
    await expect(decryptWithPassphrase(blob, "wrong")).rejects.toThrow(
      /passphrase incorrecte|altéré/i,
    );
  });

  it("refuse une passphrase vide à l'encrypt", async () => {
    await expect(encryptWithPassphrase(MNEMONIC_12, "")).rejects.toThrow(/vide/i);
  });

  it("refuse une passphrase vide au decrypt", async () => {
    const blob = await encryptWithPassphrase(MNEMONIC_12, "pw");
    await expect(decryptWithPassphrase(blob, "")).rejects.toThrow(/vide/i);
  });

  it("refuse un blob malformé (pas 4 parties)", async () => {
    await expect(decryptWithPassphrase("1.aa.bb", "pw")).rejects.toThrow(/malformé/i);
  });

  it("refuse une version non supportée", async () => {
    // Fabrique un blob v2 artificiellement.
    const blob = await encryptWithPassphrase(MNEMONIC_12, "pw");
    const parts = blob.split(".");
    parts[0] = "2";
    const fake = parts.join(".");
    await expect(decryptWithPassphrase(fake, "pw")).rejects.toThrow(/non supportée/i);
  });

  it("refuse un ciphertext altéré (tag AES-GCM invalide)", async () => {
    const blob = await encryptWithPassphrase(MNEMONIC_12, "pw");
    const parts = blob.split(".");
    // Flip le dernier caractère du ciphertext (reste base64url valide)
    const ct = parts[3];
    parts[3] = ct.slice(0, -1) + (ct.slice(-1) === "a" ? "b" : "a");
    const altered = parts.join(".");
    await expect(decryptWithPassphrase(altered, "pw")).rejects.toThrow();
  });
});

describe("isEncryptedBlob", () => {
  it("accepte un blob valide", async () => {
    const blob = await encryptWithPassphrase("x", "pw");
    expect(isEncryptedBlob(blob)).toBe(true);
  });

  it("rejette une string en clair", () => {
    expect(isEncryptedBlob("hello world")).toBe(false);
    expect(isEncryptedBlob(MNEMONIC_12)).toBe(false);
    expect(isEncryptedBlob("")).toBe(false);
  });

  it("rejette une non-string", () => {
    expect(isEncryptedBlob(undefined)).toBe(false);
    expect(isEncryptedBlob(null)).toBe(false);
    expect(isEncryptedBlob(42)).toBe(false);
    expect(isEncryptedBlob({})).toBe(false);
  });

  it("rejette un blob commençant par '1.' mais incomplet", () => {
    expect(isEncryptedBlob("1.abc.def")).toBe(false); // seulement 3 parties
    expect(isEncryptedBlob("1...")).toBe(false); // parties vides
  });
});
