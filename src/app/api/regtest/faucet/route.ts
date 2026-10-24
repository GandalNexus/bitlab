/**
 * BitLab — Faucet regtest embarqué.
 *
 * Distribue des BTC de test à une adresse regtest : le serveur construit et
 * signe une vraie transaction P2WPKH depuis son pool faucet (préminé de 101
 * blocs à la création de la chaîne), l'accepte dans le mempool puis mine
 * 1 bloc pour la confirmer. Le destinataire peut dépenser immédiatement
 * (la maturité de 100 blocs ne s'applique qu'aux récompenses coinbase).
 *
 * Aucune clé utilisateur ne transite ici : seule la clé du faucet — générée
 * localement, sans valeur — réside côté serveur.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRegtestChain, persist } from '@/lib/regtest-engine/server';
import { FAUCET_DEFAULT_SATS } from '@/lib/regtest-engine/params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { address?: unknown; sats?: unknown };
  try {
    body = (await req.json()) as { address?: unknown; sats?: unknown };
  } catch {
    return NextResponse.json({ ok: false, detail: 'corps JSON illisible' }, { status: 400 });
  }
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address) {
    return NextResponse.json({ ok: false, detail: 'adresse regtest requise' }, { status: 400 });
  }
  const satsRaw = Number(body.sats);
  const sats = Number.isFinite(satsRaw) && satsRaw > 0 ? Math.floor(satsRaw) : FAUCET_DEFAULT_SATS;

  const chain = await getRegtestChain();
  try {
    const result = chain.faucetSend(address, sats);
    await persist(chain);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, detail: (err as Error).message }, { status: 400 });
  }
}
