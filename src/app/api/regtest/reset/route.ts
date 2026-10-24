/**
 * BitLab — Réinitialisation de la chaîne regtest embarquée.
 *
 * Recrée un genèse + préminage faucet propres et purge la persistance
 * disque. L'état Lightning des nœuds du navigateur (IndexedDB) n'est pas
 * touché — le labo Lightning propose sa propre remise à zéro.
 */
import { NextResponse } from 'next/server';
import { resetRegtestChain } from '@/lib/regtest-engine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const chain = await resetRegtestChain();
  return NextResponse.json({ ok: true, engine: 'embedded', ...chain.info() });
}
