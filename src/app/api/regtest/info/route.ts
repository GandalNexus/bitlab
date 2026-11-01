import { NextResponse } from 'next/server';
import { getRegtestChain } from '@/lib/regtest-engine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const chain = await getRegtestChain();
  return NextResponse.json({ ok: true, engine: 'embedded', ...chain.info() });
}
