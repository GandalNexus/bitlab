/**
 * BitLab — Point de santé applicatif (GET /api).
 * Utilisé pour la supervision locale : aucun état, aucune donnée externe.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "bitlab",
    networks: ["mainnet", "testnet3", "testnet4", "signet"],
  });
}
