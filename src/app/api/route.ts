<<<<<<< HEAD
import { NextResponse } from "next/server";
=======
/**
 * BitLab — Point de santé applicatif (GET /api).
 * Utilisé pour la supervision locale : aucun état, aucune donnée externe.
 */
import { NextResponse } from 'next/server';
>>>>>>> 92c54ba (style: prettier-format repo)

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'bitlab',
    networks: ['mainnet', 'testnet3', 'testnet4', 'signet'],
  });
}
