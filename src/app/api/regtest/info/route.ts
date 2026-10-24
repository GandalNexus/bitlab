/**
 * BitLab — État de la chaîne regtest embarquée (lecture seule).
 *
 * Renvoie la vue d'ensemble du moteur : hauteur, tip, subvention suivante,
 * distance au halving, mempool et solde du pool faucet. Aucun nœud externe
 * requis — la chaîne vit dans le processus BitLab (cf. regtest-engine).
 */
import { NextResponse } from 'next/server';
import { getRegtestChain } from '@/lib/regtest-engine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const chain = await getRegtestChain();
  return NextResponse.json({ ok: true, engine: 'embedded', ...chain.info() });
}
