/**
 * BitLab — Minage regtest côté serveur (generatetoaddress embarqué).
 *
 * Mine `blocks` blocs à difficulté 1 sur la chaîne regtest embarquée.
 * La coinbase est payée à `address` (bcrt/m/n/2) si fournie, sinon à
 * l'adresse du faucet interne (le pool se reconstitue). Le mempool est
 * empaqueté par taux de frais décroissant — exactement le comportement
 * d'un mineur réel. Plafond : 500 blocs par requête (discipline mémoire).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRegtestChain, persist } from '@/lib/regtest-engine/server';
import { addressToScriptBcrt } from '@/lib/regtest-engine/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { blocks?: unknown; address?: unknown };
  try {
    body = (await req.json()) as { blocks?: unknown; address?: unknown };
  } catch {
    body = {};
  }
  const blocks = Math.max(1, Math.min(500, Math.floor(Number(body.blocks ?? 1)) || 1));
  const chain = await getRegtestChain();
  try {
    let payScript: Uint8Array | null = null;
    if (typeof body.address === 'string' && body.address.trim()) {
      payScript = addressToScriptBcrt(body.address); // lève si adresse invalide
    }
    const mined = chain.mineTo(payScript, blocks);
    await persist(chain);
    return NextResponse.json({
      ok: true,
      mined: mined.map((m) => ({ hash: m.hash, height: m.height, txCount: m.txCount })),
      tip: { height: chain.tipHeight(), hash: chain.tipHash() },
      poolSats: chain.faucetBalance().matureSats,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, detail: (err as Error).message }, { status: 400 });
  }
}
