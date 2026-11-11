import { describe, expect, it } from 'vitest';
import { RegtestChain } from '../src/lib/regtest-engine/chain';
import { deriveForType } from '../src/lib/bitcoin/keys';
import { hex } from '@scure/base';

function makeWallet() {
  const priv = hex.decode('aa'.repeat(32));
  return deriveForType(priv, 'segwit', 'regtest');
}

describe('wallet balance survives chain serialize/hydrate (page-refresh simulation)', () => {
  const wallet = makeWallet();

  it('addressInfo shows correct balance after deserialize — the refresh bug', () => {
    const chain = new RegtestChain();

    // Fund the wallet via faucet (mines 1 confirmation block automatically).
    chain.faucetSend(wallet.address, 50_000_000);

    // Confirm the balance is correct on the live chain.
    const liveBefore = chain.addressInfo(wallet.address);
    expect(liveBefore.chain_stats.funded_txo_sum).toBe(50_000_000);
    expect(liveBefore.chain_stats.spent_txo_sum).toBe(0);

    // Simulate a server restart: serialize → deserialize.
    const snapshot = chain.serialize();
    const reloaded = new RegtestChain(snapshot);

    // Before the fix, this returned 0 because addrTxs was not rebuilt.
    const afterReload = reloaded.addressInfo(wallet.address);
    expect(afterReload.chain_stats.funded_txo_sum).toBe(50_000_000);
    expect(afterReload.chain_stats.spent_txo_sum).toBe(0);
    expect(afterReload.chain_stats.tx_count).toBeGreaterThan(0);
  });

  it('addressUtxos also returns correct UTXOs after reload', () => {
    const chain = new RegtestChain();
    chain.faucetSend(wallet.address, 25_000_000);

    const snapshot = chain.serialize();
    const reloaded = new RegtestChain(snapshot);

    const utxos = reloaded.addressUtxos(wallet.address);
    expect(utxos.length).toBeGreaterThan(0);
    const total = utxos.reduce((s, u) => s + u.value, 0);
    expect(total).toBe(25_000_000);
    expect(utxos[0].status.confirmed).toBe(true);
  });

  it('balance stays correct after spend-then-reload', () => {
    const chain = new RegtestChain();

    // Fund wallet with two separate faucet calls.
    chain.faucetSend(wallet.address, 10_000_000);
    chain.faucetSend(wallet.address, 20_000_000);

    // Reload — balance must reflect both deposits.
    const reloaded = new RegtestChain(chain.serialize());
    const info = reloaded.addressInfo(wallet.address);
    expect(info.chain_stats.funded_txo_sum).toBe(30_000_000);
    expect(info.chain_stats.spent_txo_sum).toBe(0);
  });
});
