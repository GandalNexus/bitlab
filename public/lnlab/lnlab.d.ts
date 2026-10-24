/* tslint:disable */
/* eslint-disable */
export class LnLab {
  private constructor();
  free(): void;
  /**
   * Current chain position of the lab (both nodes share the feed).
   */
  best_block(): any;
  /**
   * Boots two fresh nodes whose chain view starts at the current tip.
   */
  static boot_fresh(network: string, seed_a: Uint8Array, seed_b: Uint8Array, tip_height: number, tip_hash: string, now_secs: number): LnLab;
  /**
   * Opens the in-memory P2P link A -> B (real noise handshake).
   */
  connect_ab(): void;
  /**
   * Processes one chain block (hex) for both nodes; returns emitted events.
   */
  chain_block(height: number, block_hex: string): Array<any>;
  /**
   * Pays a BOLT11 invoice over the direct channel (real HTLC, real routing).
   */
  pay_invoice(node: number, invoice: string, amount_msat_override?: bigint | null): void;
  /**
   * Boots two nodes from IndexedDB-backed state (KV entries + manager bytes).
   */
  static boot_restore(network: string, seed_a: Uint8Array, seed_b: Uint8Array, now_secs: number, kv_a: Array<any>, kv_b: Array<any>): LnLab;
  /**
   * Creates a real BOLT12 offer (lno1…) on the selected node. The offer
   * carries a one-hop blinded message path back to the issuing node, so
   * any peer of that node can request an invoice through onion messages.
   */
  create_offer(node: number, amount_msat: bigint | null | undefined, description: string): string;
  /**
   * Decodes a BOLT12 offer without touching any node state (static).
   */
  static decode_offer(offer: string): any;
  /**
   * True while the in-memory P2P link is up.
   */
  is_connected(): boolean;
  /**
   * Closes a channel cooperatively from the selected node.
   */
  close_channel(node: number, channel_id_hex: string): void;
  /**
   * Channel summary for the selected node.
   */
  list_channels(node: number): Array<any>;
  /**
   * Opens a channel from A to B. The funding transaction is built and signed
   * by the lab wallet in the main thread when `funding_generation_ready`
   * arrives, then handed back via `funding_transaction_generated`.
   */
  create_channel(value_sats: bigint, push_msat: bigint, user_channel_id: bigint): void;
  /**
   * Creates and signs a real BOLT11 invoice on the selected node.
   */
  create_invoice(node: number, amount_msat: bigint | null | undefined, description: string, expiry_secs: number, now_secs: number): string;
  /**
   * Decodes a BOLT11 invoice without touching any node state (static).
   */
  static decode_invoice(invoice: string): any;
  /**
   * Feeds back the funding transaction built by the lab wallet.
   */
  funding_transaction_generated(user_channel_id: bigint, tx_hex: string): void;
  /**
   * Recent LDK log lines for the selected node (bounded tail).
   */
  logs(node: number): Array<any>;
  /**
   * Drives the protocol: message pump + pending events + persistence.
   * Returns the events emitted during this tick.
   */
  tick(): Array<any>;
  /**
   * Compressed public key (node id) of the selected node, hex-encoded.
   */
  node_id(node: number): string;
  /**
   * Drains pending KV writes for both nodes: entries of
   * [nodeLabel, primary, secondary, key, Uint8Array | null].
   */
  kv_dirty(): Array<any>;
  /**
   * Pushes fee rates (sat/kwu) converted from Esplora sat/vB by the worker.
   */
  set_fees(fast: number, normal: number, slow: number): void;
  /**
   * Pays a BOLT12 offer from the selected node: sends an invoice request
   * over onion messages, then pays the returned invoice over the direct
   * channel. The result surfaces later as normal payment events.
   */
  pay_offer(node: number, offer: string, amount_msat?: bigint | null, payer_note?: string | null): void;
}
