import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "bitlab",
    networks: ["mainnet", "testnet3", "testnet4", "signet"],
  });
}
