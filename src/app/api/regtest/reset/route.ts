import { NextResponse } from 'next/server';
import { resetRegtestChain } from '@/lib/regtest-engine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const chain = await resetRegtestChain();
  return NextResponse.json({ ok: true, engine: 'embedded', ...chain.info() });
}
