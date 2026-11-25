import { describe, expect, it } from 'vitest';
import { createWallet } from '../src/lib/bitcoin/keys';
import { isLocked, lockWallet, unlockWallet } from '../src/lib/bitcoin/wallet-lock';

describe('lock / unlock wallet (LOT 72)', () => {
  it('lock + unlock roundtrip préserve les champs sensibles', async () => {
    const original = createWallet('segwit', 12);
    const locked = await lockWallet(original, 'passphrase-10-chars');
    expect(isLocked(locked)).toBe(true);
    expect(locked.encryptedBlob).toMatch(/^1\./);
    // Address + pubkey restent en clair
    expect(locked.address).toBe(original.address);
    expect(locked.publicKeyHex).toBe(original.publicKeyHex);

    const unlocked = await unlockWallet(locked, 'passphrase-10-chars');
    expect(unlocked.privateKeyHex).toBe(original.privateKeyHex);
    expect(unlocked.wif).toBe(original.wif);
    expect(unlocked.mnemonic).toBe(original.mnemonic);
    expect(isLocked(unlocked)).toBe(false);
  });

  it('refuse une passphrase < 10 chars à lock', async () => {
    const w = createWallet('segwit', 12);
    await expect(lockWallet(w, 'short')).rejects.toThrow(/10 caractères/);
  });

  it('unlock avec mauvaise passphrase → throw', async () => {
    const original = createWallet('segwit', 12);
    const locked = await lockWallet(original, 'right-passphrase-xx');
    await expect(unlockWallet(locked, 'wrong-passphrase-xx')).rejects.toThrow();
  });

  it('locked wallet ne contient PAS les secrets plaintext', async () => {
    const original = createWallet('segwit', 12);
    const locked = await lockWallet(original, 'passphrase-10-chars');
    // Serialize pour inspection
    const json = JSON.stringify(locked);
    expect(json).not.toContain(original.privateKeyHex);
    expect(json).not.toContain(original.wif);
    expect(json).not.toContain(original.mnemonic ?? '__nothing__');
  });

  it('isLocked discrimine correctement', async () => {
    const original = createWallet('taproot', 24);
    expect(isLocked(original)).toBe(false);
    const locked = await lockWallet(original, 'passphrase-10-chars');
    expect(isLocked(locked)).toBe(true);
  });
});
