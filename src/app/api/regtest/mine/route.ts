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
      payScript = addressToScriptBcrt(body.address);
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
