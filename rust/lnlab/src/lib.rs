//! BitLab lnlab — two real LDK Lightning nodes compiled to WebAssembly.
//!
//! Exposes a single `LnLab` object to the JavaScript worker:
//!  - node A and node B are full LDK 0.2 nodes (real keys, real protocol
//!    messages, real HTLCs) connected through an in-memory socket pair;
//!  - chain data comes from JavaScript (same-origin Esplora proxy), because
//!    mempool.space sends no CORS headers;
//!  - persistence goes through JavaScript (IndexedDB) via `KVStoreSync`;
//!  - no wall clock is ever used (wasm32-unknown-unknown has none): every
//!    timestamp is passed explicitly from JavaScript.
//!
//! The `std` feature of LDK is disabled in `Cargo.toml` so that none of its
//! internal `SystemTime`/`Instant` calls (which trap on wasm32) are compiled.

mod chainio;
mod events;
mod node;
mod sockets;
mod store;

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::str::FromStr;

use bitcoin::block::Block;
use bitcoin::consensus::deserialize;
use bitcoin::hashes::sha256;
use bitcoin::hashes::Hash as _;
use bitcoin::hex::FromHex;
use bitcoin::transaction::Transaction;
use bitcoin::constants::ChainHash;
use bitcoin::{BlockHash, Network};
use js_sys::{Array, Object, Uint8Array};
use lightning::chain::{BestBlock, Listen};
use lightning::events::{Event, EventsProvider, ReplayEvent};
use lightning::ln::channelmanager::{
        OptionalOfferPaymentParams, PaymentId, RecipientOnionFields, Retry,
};
use lightning::ln::types::ChannelId;
use lightning::offers::offer::{Amount, Offer};
use lightning::routing::router::{PaymentParameters, RouteParameters};
use lightning::sign::{EntropySource as _, KeysManager, NodeSigner as _, Recipient};
use lightning::types::payment::PaymentHash;
use lightning::events::PaymentPurpose;
use lightning::util::persist::KVStoreSync as _;
use lightning::util::ser::Writeable as _;
use lightning_invoice::{Bolt11Invoice, Currency, InvoiceBuilder};
use wasm_bindgen::prelude::*;

use chainio::FeeRates;
use node::LnNode;
use sockets::{LnSocket, Link};
use store::{SharedKv, shared_store};

fn default_fees() -> FeeRates {
        FeeRates { fast: 2500, normal: 1000, slow: 500 }
}

fn network_of(slug: &str) -> Result<Network, JsValue> {
        match slug {
                "testnet4" => Ok(Network::Testnet4),
                "testnet3" => Ok(Network::Testnet),
                "signet" => Ok(Network::Signet),
                "regtest" => Ok(Network::Regtest),
                other => Err(JsValue::from_str(&format!("réseau Lightning non supporté : {}", other))),
        }
}

fn currency_of(network: Network) -> Result<Currency, JsValue> {
        match network {
                // BOLT11 has no distinct HRN for testnet4: both testnets share the
                // "tb" bech32 prefix (Currency::BitcoinTestnet), like addresses do.
                Network::Testnet | Network::Testnet4 => Ok(Currency::BitcoinTestnet),
                Network::Signet => Ok(Currency::Signet),
                // Regtest: lnbcrt prefix (Currency::Regtest).
                Network::Regtest => Ok(Currency::Regtest),
                _ => Err(JsValue::from_str("réseau non supporté pour le laboratoire Lightning")),
        }
}

fn seed_of(bytes: &[u8], label: &str) -> Result<[u8; 32], JsValue> {
        let seed: [u8; 32] = bytes
                .try_into()
                .map_err(|_| JsValue::from_str(&format!("graine {} invalide (32 octets attendus)", label)))?;
        Ok(seed)
}

fn tx_from_hex(hex: &str) -> Result<Transaction, JsValue> {
        let bytes = Vec::<u8>::from_hex(hex.trim())
                .map_err(|_| JsValue::from_str("transaction hexadécimale invalide"))?;
        deserialize(&bytes).map_err(|_| JsValue::from_str("transaction non décodable"))
}

fn js_err(message: String) -> JsValue {
        JsValue::from_str(&message)
}

/// Writes a string property on a JS object (js_sys::Object::set takes JsValues).
fn put(obj: &Object, key: &str, value: String) {
        js_sys::Reflect::set(obj, &JsValue::from_str(key), &JsValue::from_str(&value)).expect("set property");
}

/// Writes a native boolean property. Channel flags used to be stringified
/// ("true"/"false"), which JS treats as always-truthy — the UI then showed
/// « prêt » on channels that were still awaiting confirmations.
fn put_bool(obj: &Object, key: &str, value: bool) {
        js_sys::Reflect::set(obj, &JsValue::from_str(key), &JsValue::from_bool(value)).expect("set property");
}

/// Options passed by the worker at boot: node selector (0 = A, 1 = B).
fn pick(node: u8) -> Result<usize, JsValue> {
        match node {
                0 => Ok(0),
                1 => Ok(1),
                other => Err(js_err(format!("nœud inconnu : {}", other))),
        }
}

#[wasm_bindgen]
pub struct LnLab {
        network: Network,
        nodes: [LnNode; 2],
        /// Active peer link (descriptors + inboxes), rebuilt on every reconnect.
        link: Option<(LnSocket, LnSocket, Link)>,
        pending_funding: RefCell<HashMap<u64, (ChannelId, bitcoin::secp256k1::PublicKey)>>,
        /// Ticks since the last `timer_tick_occurred` (one per LDK minute).
        timer_ticks: Cell<u32>,
}

#[wasm_bindgen]
impl LnLab {
        /// Boots two fresh nodes whose chain view starts at the current tip.
        #[allow(clippy::too_many_arguments)]
        pub fn boot_fresh(
                network: &str, seed_a: &[u8], seed_b: &[u8], tip_height: u32, tip_hash: &str, now_secs: u32,
        ) -> Result<LnLab, JsValue> {
                console_error_panic_hook::set_once();
                let network = network_of(network)?;
                let hash = BlockHash::from_str(tip_hash)
                        .map_err(|_| js_err("hash de bloc invalide".to_string()))?;
                let parts_a = node::NodeParts {
                        seed: seed_of(seed_a, "A")?,
                        fees: default_fees(),
                        network,
                        kv: shared_store(),
                        now_secs,
                        now_nanos: 0,
                };
                let parts_b = node::NodeParts {
                        seed: seed_of(seed_b, "B")?,
                        fees: default_fees(),
                        network,
                        kv: shared_store(),
                        now_secs,
                        now_nanos: 0,
                };
                let a = node::build_fresh(&parts_a, BestBlock::new(hash, tip_height));
                let b = node::build_fresh(&parts_b, BestBlock::new(hash, tip_height));
                let mut lab = LnLab {
                        network,
                        nodes: [a, b],
                        link: None,
                        pending_funding: RefCell::new(HashMap::new()),
                        timer_ticks: Cell::new(0),
                };
                // Peers connect on activation — no extra click needed. Failure
                // is non-fatal: tick() self-heals on the next pass.
                let _ = lab.connect_ab();
                Ok(lab)
        }

        /// Boots two nodes from IndexedDB-backed state (KV entries + manager bytes).
        pub fn boot_restore(
                network: &str, seed_a: &[u8], seed_b: &[u8], now_secs: u32, kv_a: Array, kv_b: Array,
        ) -> Result<LnLab, JsValue> {
                console_error_panic_hook::set_once();
                let network = network_of(network)?;
                let kv_a = restore_store(&kv_a)?;
                let kv_b = restore_store(&kv_b)?;
                let parts_a = node::NodeParts {
                        seed: seed_of(seed_a, "A")?,
                        fees: default_fees(),
                        network,
                        kv: kv_a,
                        now_secs,
                        now_nanos: 0,
                };
                let parts_b = node::NodeParts {
                        seed: seed_of(seed_b, "B")?,
                        fees: default_fees(),
                        network,
                        kv: kv_b,
                        now_secs,
                        now_nanos: 0,
                };
                let a = node::build_restored(&parts_a).map_err(js_err)?;
                let b = node::build_restored(&parts_b).map_err(js_err)?;
                let mut lab = LnLab {
                        network,
                        nodes: [a, b],
                        link: None,
                        pending_funding: RefCell::new(HashMap::new()),
                        timer_ticks: Cell::new(0),
                };
                // A restored session re-handshakes immediately; LDK then rebuilds
                // the persisted channels over the fresh link.
                let _ = lab.connect_ab();
                Ok(lab)
        }

        /// Compressed public key (node id) of the selected node, hex-encoded.
        pub fn node_id(&self, node: u8) -> Result<String, JsValue> {
                Ok(self.nodes[pick(node)?].cm.get_our_node_id().to_string())
        }

        /// Current chain position of the lab (both nodes share the feed).
        pub fn best_block(&self) -> JsValue {
                let best = self.nodes[0].cm.current_best_block();
                let obj = Object::new();
                put(&obj, "height", best.height.to_string());
                put(&obj, "hash", best.block_hash.to_string());
                obj.into()
        }

        /// Pushes fee rates (sat/kwu) converted from Esplora sat/vB by the worker.
        pub fn set_fees(&self, fast: u32, normal: u32, slow: u32) {
                for node in &self.nodes {
                        node.fee.set_rates(FeeRates { fast, normal, slow });
                }
        }

        /// Recent LDK log lines for the selected node (bounded tail).
        pub fn logs(&self, node: u8) -> Result<Array, JsValue> {
                let lines = self.nodes[pick(node)?].logger.tail_strings();
                Ok(lines.into_iter().map(|s| JsValue::from_str(&s)).collect())
        }

        /// Opens the in-memory P2P link A -> B (real noise handshake).
        ///
        /// Idempotent and self-repairing: any previous link is torn down first
        /// (`socket_disconnected` on both PeerManagers), so stale entries can
        /// never make `new_*_connection` reject with `Entry::Occupied` — that
        /// was the root cause of the dead "reconnect" button.
        pub fn connect_ab(&mut self) -> Result<(), JsValue> {
                if self.is_connected() {
                        return Ok(());
                }
                self.teardown_link();
                let (desc_a, desc_b, link) = LnSocket::pair();
                let init = self.nodes[0]
                        .pm
                        .new_outbound_connection(
                                self.nodes[1].cm.get_our_node_id(),
                                desc_a.clone(),
                                None,
                        )
                        .map_err(|e| {
                                // Half-registered handshake: clear both entries
                                // so the next attempt (tick self-heal) is clean.
                                self.teardown_link();
                                js_err(format!("connexion A -> B refusée : {:?}", e))
                        })?;
                // Initial noise message is destined to B.
                link.inbox_b.borrow_mut().push_back(init);
                if let Err(e) = self.nodes[1].pm.new_inbound_connection(desc_b.clone(), None) {
                        self.teardown_link();
                        return Err(js_err(format!("écoute B refusée : {:?}", e)));
                }
                self.link = Some((desc_a, desc_b, link));
                self.flush_io().map(|_| ())
        }

        /// Tears down the current link: closes the socket pair and tells both
        /// PeerManagers the peer is gone. Descriptors are side-keyed (side 0 / 1),
        /// so `socket_disconnected` also clears entries left behind by a failed
        /// handshake even when `self.link` is already `None`; it is a documented
        /// no-op for unknown descriptors.
        fn teardown_link(&mut self) {
                if let Some((_, _, link)) = self.link.take() {
                        *link.open.borrow_mut() = false;
                }
                let (desc_a, desc_b, _) = LnSocket::pair();
                self.nodes[0].pm.socket_disconnected(&desc_a);
                self.nodes[1].pm.socket_disconnected(&desc_b);
        }

        /// True while the in-memory P2P link is up.
        pub fn is_connected(&self) -> bool {
                self.link.as_ref().map(|(_, _, link)| *link.open.borrow()).unwrap_or(false)
        }

        /// Processes one chain block (hex) for both nodes; returns emitted events.
        pub fn chain_block(&mut self, height: u32, block_hex: &str) -> Result<Array, JsValue> {
                let bytes = Vec::<u8>::from_hex(block_hex.trim())
                        .map_err(|_| js_err("bloc hexadécimal invalide".to_string()))?;
                let block: Block = deserialize(&bytes).map_err(|_| js_err("bloc non décodable".to_string()))?;
                // The `Listen` tuple impl requires owning Derefs, hence the clones.
                let tap_a = (self.nodes[0].cm.clone(), self.nodes[0].monitor.clone());
                tap_a.block_connected(&block, height);
                let tap_b = (self.nodes[1].cm.clone(), self.nodes[1].monitor.clone());
                tap_b.block_connected(&block, height);
                self.tick()
        }

        /// Opens a channel from A to B. The funding transaction is built and signed
        /// by the lab wallet in the main thread when `funding_generation_ready`
        /// arrives, then handed back via `funding_transaction_generated`.
        pub fn create_channel(&mut self, value_sats: u64, push_msat: u64, user_channel_id: u64) -> Result<(), JsValue> {
                let their_id = self.nodes[1].cm.get_our_node_id();
                self.nodes[0]
                        .cm
                        .create_channel(their_id, value_sats, push_msat, user_channel_id as u128, None, None)
                        .map_err(|e| js_err(format!("création de canal refusée : {:?}", e)))?;
                Ok(())
        }

        /// Feeds back the funding transaction built by the lab wallet.
        pub fn funding_transaction_generated(&mut self, user_channel_id: u64, tx_hex: &str) -> Result<(), JsValue> {
                let (temporary_channel_id, counterparty) = self
                        .pending_funding
                        .borrow_mut()
                        .remove(&user_channel_id)
                        .ok_or_else(|| js_err("aucune demande de financement en attente".to_string()))?;
                let tx = tx_from_hex(tx_hex)?;
                self.nodes[0]
                        .cm
                        .funding_transaction_generated(temporary_channel_id, counterparty, tx)
                        .map_err(|e| js_err(format!("transaction de financement refusée : {:?}", e)))?;
                Ok(())
        }

        /// Creates and signs a real BOLT11 invoice on the selected node.
        pub fn create_invoice(
                &mut self, node: u8, amount_msat: Option<u64>, description: &str, expiry_secs: u32, now_secs: u32,
        ) -> Result<String, JsValue> {
                let idx = pick(node)?;
                let currency = currency_of(self.network)?;
                let node_ref = &self.nodes[idx];
                let (hash, secret) = node_ref
                        .cm
                        .create_inbound_payment(amount_msat, expiry_secs, None)
                        .map_err(|_| js_err("création du paiement entrant impossible".to_string()))?;
                let description = if description.trim().is_empty() { "BitLab" } else { description };
                let mut builder = InvoiceBuilder::new(currency)
                        .description(description.trim().chars().take(120).collect())
                        .payment_hash(sha256::Hash::from_byte_array(hash.0))
                        .payment_secret(secret)
                        .duration_since_epoch(std::time::Duration::from_secs(now_secs as u64))
                        .min_final_cltv_expiry_delta(18)
                        .expiry_time(std::time::Duration::from_secs(expiry_secs as u64))
                        .payee_pub_key(node_ref.cm.get_our_node_id());
                if let Some(amount) = amount_msat {
                        builder = builder.amount_milli_satoshis(amount);
                }
                let raw = builder.build_raw().map_err(|e| js_err(format!("facture invalide : {:?}", e)))?;
                // `sign_invoice` hashes the raw invoice itself, so we hand it the
                // original while `sign` consumes a clone.
                let signed = raw
                        .clone()
                        .sign(|_| {
                                node_ref
                                        .keys
                                        .sign_invoice(&raw, Recipient::Node)
                                        .map_err(|_| "échec de la clé de signature".to_string())
                        })
                        .map_err(|e| js_err(format!("signature de facture impossible : {}", e)))?;
                let invoice = Bolt11Invoice::from_signed(signed)
                        .map_err(|e| js_err(format!("facture signée invalide : {:?}", e)))?;
                self.flush_io()?;
                Ok(invoice.to_string())
        }

        /// Pays a BOLT11 invoice over the direct channel (real HTLC, real routing).
        pub fn pay_invoice(&mut self, node: u8, invoice: &str, amount_msat_override: Option<u64>) -> Result<(), JsValue> {
                let idx = pick(node)?;
                let inv: Bolt11Invoice =
                        Bolt11Invoice::from_str(invoice).map_err(|e| js_err(format!("facture illisible : {}", e)))?;
                let expected = currency_of(self.network)?;
                if inv.currency() != expected {
                        return Err(js_err("facture émise sur un autre réseau que le laboratoire".to_string()));
                }
                let payee = inv.recover_payee_pub_key();
                let payment_hash = PaymentHash(inv.payment_hash().to_byte_array());
                let secret = *inv.payment_secret();
                let final_value_msat = amount_msat_override
                        .or(inv.amount_milli_satoshis())
                        .ok_or_else(|| js_err("montant requis (facture sans montant)".to_string()))?;
                let route_params = RouteParameters {
                        payment_params: PaymentParameters::from_node_id(
                                payee,
                                inv.min_final_cltv_expiry_delta() as u32,
                        ),
                        final_value_msat,
                        max_total_routing_fee_msat: None,
                };
                let node_ref = &self.nodes[idx];
                let payment_id = PaymentId(node_ref.keys.get_secure_random_bytes());
                node_ref
                        .cm
                        .send_payment(
                                payment_hash,
                                RecipientOnionFields::secret_only(secret),
                                payment_id,
                                route_params,
                                Retry::Attempts(5),
                        )
                        .map_err(|e| js_err(format!("envoi refusé : {:?}", e)))?;
                Ok(())
        }

        /// Creates a real BOLT12 offer (lno1…) on the selected node. The offer
        /// carries a one-hop blinded message path back to the issuing node, so
        /// any peer of that node can request an invoice through onion messages.
        pub fn create_offer(&self, node: u8, amount_msat: Option<u64>, description: &str) -> Result<String, JsValue> {
                let idx = pick(node)?;
                let description = description.trim();
                if description.is_empty() {
                        return Err(js_err("description requise pour une offer".to_string()));
                }
                let builder = self.nodes[idx]
                        .cm
                        .create_offer_builder()
                        .map_err(|e| js_err(format!("création d'offer impossible : {:?}", e)))?
                        .chain(self.network)
                        .description(description.chars().take(120).collect());
                let builder = match amount_msat {
                        Some(amount) => builder.amount_msats(amount),
                        None => builder,
                };
                let offer = builder
                        .build()
                        .map_err(|e| js_err(format!("offer invalide : {:?}", e)))?;
                self.flush_io()?;
                Ok(offer.to_string())
        }

        /// Pays a BOLT12 offer from the selected node: sends an invoice request
        /// over onion messages, then pays the returned invoice over the direct
        /// channel. The result surfaces later as normal payment events.
        pub fn pay_offer(&mut self, node: u8, offer: &str, amount_msat: Option<u64>, payer_note: Option<String>) -> Result<(), JsValue> {
                let idx = pick(node)?;
                let offer: Offer = Offer::from_str(offer.trim())
                        .map_err(|e| js_err(format!("offer illisible : {:?}", e)))?;
                let genesis = ChainHash::using_genesis_block(self.network);
                let chains = offer.chains();
                if !chains.is_empty() && !chains.contains(&genesis) {
                        return Err(js_err("offer émise sur un autre réseau que le laboratoire".to_string()));
                }
                let node_ref = &self.nodes[idx];
                let payment_id = PaymentId(node_ref.keys.get_secure_random_bytes());
                let mut params = OptionalOfferPaymentParams::default();
                if let Some(note) = payer_note {
                        let note = note.trim().chars().take(120).collect::<String>();
                        if !note.is_empty() {
                                params.payer_note = Some(note);
                        }
                }
                node_ref
                        .cm
                        .pay_for_offer(&offer, amount_msat, payment_id, params)
                        .map_err(|e| js_err(format!("paiement d'offer refusé : {:?}", e)))?;
                Ok(())
        }

        /// Decodes a BOLT12 offer without touching any node state (static).
        pub fn decode_offer(offer: &str) -> Result<JsValue, JsValue> {
                let offer: Offer = Offer::from_str(offer.trim())
                        .map_err(|e| js_err(format!("offer illisible : {:?}", e)))?;
                let obj = Object::new();
                put(
                        &obj,
                        "description",
                        offer.description().map(|d| d.to_string()).unwrap_or_default(),
                );
                let amount = match offer.amount() {
                        Some(Amount::Bitcoin { amount_msats }) => amount_msats.to_string(),
                        _ => String::new(),
                };
                put(&obj, "amountMsat", amount);
                put(&obj, "issuer", offer.issuer().map(|i| i.to_string()).unwrap_or_default());
                if let Some(expiry) = offer.absolute_expiry() {
                        put(&obj, "absoluteExpiry", expiry.as_secs().to_string());
                }
                put(
                        &obj,
                        "signingPubkey",
                        offer.issuer_signing_pubkey().map(|k| k.to_string()).unwrap_or_default(),
                );
                Ok(obj.into())
        }

        /// Decodes a BOLT11 invoice without touching any node state (static).
        pub fn decode_invoice(invoice: &str) -> Result<JsValue, JsValue> {
                let inv: Bolt11Invoice =
                        Bolt11Invoice::from_str(invoice).map_err(|e| js_err(format!("facture illisible : {}", e)))?;
                let obj = Object::new();
                put(&obj, "currency", format!("{:?}", inv.currency()));
                put(&obj, "payee", inv.recover_payee_pub_key().to_string());
                put(&obj, "paymentHash", inv.payment_hash().to_string());
                put(
                        &obj,
                        "amountMsat",
                        inv.amount_milli_satoshis().map(|a| a.to_string()).unwrap_or_default(),
                );
                put(&obj, "minFinalCltv", inv.min_final_cltv_expiry_delta().to_string());
                put(&obj, "description", invoice_description(&inv));
                Ok(obj.into())
        }

        /// Closes a channel cooperatively from the selected node.
        pub fn close_channel(&mut self, node: u8, channel_id_hex: &str) -> Result<(), JsValue> {
                let idx = pick(node)?;
                let bytes = Vec::<u8>::from_hex(channel_id_hex.trim())
                        .map_err(|_| js_err("channel_id invalide".to_string()))?;
                let arr: [u8; 32] = bytes
                        .try_into()
                        .map_err(|_| js_err("channel_id invalide".to_string()))?;
                let channel_id = ChannelId::from_bytes(arr);
                let counterparty = self.nodes[idx]
                        .cm
                        .list_channels()
                        .iter()
                        .find(|c| c.channel_id == channel_id)
                        .map(|c| c.counterparty.node_id)
                        .ok_or_else(|| js_err("canal introuvable".to_string()))?;
                self.nodes[idx]
                        .cm
                        .close_channel(&channel_id, &counterparty)
                        .map_err(|e| js_err(format!("fermeture refusée : {:?}", e)))?;
                Ok(())
        }

        /// Channel summary for the selected node.
        pub fn list_channels(&self, node: u8) -> Result<Array, JsValue> {
                let idx = pick(node)?;
                Ok(self.channels_of(idx))
        }

        /// Drains pending KV writes for both nodes: entries of
        /// [nodeLabel, primary, secondary, key, Uint8Array | null].
        pub fn kv_dirty(&self) -> Array {
                let out = Array::new();
                for (idx, label) in ["A", "B"].iter().enumerate() {
                        for (key, value) in self.nodes[idx].kv.take_dirty() {
                                let entry = Array::new();
                                entry.push(&JsValue::from_str(label));
                                entry.push(&JsValue::from_str(&key.0));
                                entry.push(&JsValue::from_str(&key.1));
                                entry.push(&JsValue::from_str(&key.2));
                                match value {
                                        Some(bytes) => {
                                                entry.push(&Uint8Array::from(bytes.as_slice()));
                                        },
                                        None => {
                                                entry.push(&JsValue::NULL);
                                        },
                                }
                                out.push(&entry);
                        }
                }
                out
        }

        /// Drives the protocol: message pump + pending events + persistence.
        /// Returns the events emitted during this tick.
        pub fn tick(&mut self) -> Result<Array, JsValue> {
                // Self-healing: rebuild the peer link whenever it is down, so a
                // dropped handshake never wedges the lab (idempotent no-op while
                // the link is healthy).
                if !self.is_connected() {
                        self.connect_ab()?;
                }
                let activity = self.flush_io()?;
                let mut collected: Vec<JsValue> = Vec::new();
                let pending = &self.pending_funding;
                for (idx, label) in ["A", "B"].iter().enumerate() {
                        let node = &self.nodes[idx];
                        let sink = RefCell::new(&mut collected);
                        let label = *label;
                        let handler = |event: Event| -> Result<(), ReplayEvent> {
                                // Record the funding request so the main thread can
                                // hand the signed transaction back via
                                // `funding_transaction_generated` — keyed by the
                                // user_channel_id chosen at create_channel. Without
                                // this, that call rejects with « aucune demande de
                                // financement en attente » and no channel ever
                                // confirms.
                                if let Event::FundingGenerationReady {
                                        temporary_channel_id,
                                        counterparty_node_id,
                                        user_channel_id,
                                        ..
                                } = &event
                                {
                                        pending.borrow_mut().insert(
                                                *user_channel_id as u64,
                                                (*temporary_channel_id, *counterparty_node_id),
                                        );
                                }
                                // Auto-claim : réclame immédiatement tout paiement entrant
                                // dont le preimage est connu (factures BOLT11 créées ici,
                                // BOLT12 via invoice_request, paiements spontanés). Sans
                                // cela l'event `payment_claimable` restait sans réponse —
                                // aucun code ne rappelait `claim_funds` — et les HTLCs ne
                                // se réglaient jamais : le paiement côté émetteur restait
                                // bloqué sans `payment_sent`.
                                if let Event::PaymentClaimable { purpose, .. } = &event {
                                        let preimage = match purpose {
                                                PaymentPurpose::Bolt11InvoicePayment { payment_preimage: Some(pre), .. } => Some(*pre),
                                                PaymentPurpose::Bolt12OfferPayment { payment_preimage: Some(pre), .. } => Some(*pre),
                                                PaymentPurpose::Bolt12RefundPayment { payment_preimage: Some(pre), .. } => Some(*pre),
                                                PaymentPurpose::SpontaneousPayment(pre) => Some(*pre),
                                                _ => None,
                                        };
                                        if let Some(preimage) = preimage {
                                                node.cm.claim_funds(preimage);
                                        }
                                }
                                sink.borrow_mut().push(events::event_to_js(label, &event));
                                Ok(())
                        };
                        // Random forward delay : LDK pousse les HTLCs entrants dans
                        // une file traitée par son background processor via
                        // `process_pending_htlc_forwards` — aucun n'appelait cette
                        // fonction, donc `payment_claimable` n'était jamais émis et
                        // aucun paiement ne se réglait. Le labo la lance à chaque
                        // tick : le règlement est immédiat, comme un nœud sain.
                        node.cm.process_pending_htlc_forwards();
                        node.cm.process_pending_events(&handler);
                }
                // LDK recommande `timer_tick_occurred` environ une fois par
                // minute : expiration des MPP incomplets, retraits des paiements
                // en échec, etc. Tick du worker = 1 s, donc une fois toutes les
                // 60 itérations.
                self.timer_ticks.set(self.timer_ticks.get() + 1);
                if self.timer_ticks.get() >= 60 {
                        self.timer_ticks.set(0);
                        for node in &self.nodes {
                                node.cm.timer_tick_occurred();
                        }
                }
                // Persist both channel managers only when something happened this
                // tick (protocol traffic or emitted events): re-encoding two full
                // managers every second flooded the KV drain with one write per
                // second per node even while the lab sat idle.
                if activity > 0 || !collected.is_empty() {
                        for node in &self.nodes {
                                let bytes = node.cm.encode();
                                let _ = node.kv.write("", "", "manager", bytes);
                        }
                }
                Ok(events::events_to_array(collected))
        }
}

impl LnLab {
        /// Pumps the socket pair until it goes quiet. Returns the number of
        /// protocol bytes processed — the caller uses it to decide whether the
        /// channel managers are worth persisting this tick.
        fn flush_io(&self) -> Result<usize, JsValue> {
                let Some((desc_a, desc_b, link)) = &self.link else {
                        return Ok(0);
                };
                if !*link.open.borrow() {
                        return Err(js_err("liaison P2P fermée".to_string()));
                }
                let mut total = 0usize;
                for _round in 0..64 {
                        let mut activity = false;
                        for (pm, desc, inbox) in [
                                (&self.nodes[0].pm, desc_a, &link.inbox_a),
                                (&self.nodes[1].pm, desc_b, &link.inbox_b),
                        ] {
                                loop {
                                        let next = inbox.borrow_mut().pop_front();
                                        let Some(data) = next else { break };
                                        activity = true;
                                        total += data.len();
                                        if pm.read_event(&mut desc.clone(), &data).is_err() {
                                                desc.disconnect_both();
                                                return Err(js_err("pair déconnecté (erreur de protocole)".to_string()));
                                        }
                                }
                        }
                        self.nodes[0].pm.process_events();
                        self.nodes[1].pm.process_events();
                        let pending = link.inbox_a.borrow().len() + link.inbox_b.borrow().len();
                        if pending == 0 && !activity {
                                break;
                        }
                }
                Ok(total)
        }

        fn channels_of(&self, idx: usize) -> Array {
                let details = self.nodes[idx].cm.list_channels();
                details
                        .iter()
                        .map(|c| -> JsValue {
                                let obj = Object::new();
                                put(&obj, "channelId", c.channel_id.to_string());
                                put(&obj, "userChannelId", (c.user_channel_id as u64).to_string());
                                put(&obj, "counterparty", c.counterparty.node_id.to_string());
                                put(&obj, "valueSats", c.channel_value_satoshis.to_string());
                                put(&obj, "outboundMsat", c.outbound_capacity_msat.to_string());
                                put(&obj, "inboundMsat", c.inbound_capacity_msat.to_string());
                                put_bool(&obj, "isOutbound", c.is_outbound);
                                put_bool(&obj, "isReady", c.is_channel_ready);
                                put_bool(&obj, "isUsable", c.is_usable);
                                put_bool(&obj, "isAnnounced", c.is_announced);
                                if let Some(funding) = &c.funding_txo {
                                        put(&obj, "fundingTxo", funding.to_string());
                                }
                                if let Some(conf) = c.confirmations {
                                        put(&obj, "confirmations", conf.to_string());
                                }
                                if let Some(required) = c.confirmations_required {
                                        put(&obj, "confirmationsRequired", required.to_string());
                                }
                                obj.into()
                        })
                        .collect()
        }
}

/// Rebuilds a KV store from a JS array of [primary, secondary, key, Uint8Array].
fn restore_store(entries: &Array) -> Result<SharedKv, JsValue> {
        let kv = shared_store();
        for entry in entries.iter() {
                let arr = Array::from(&entry);
                let primary = arr.get(0).as_string().ok_or_else(|| js_err("entrée KV invalide".to_string()))?;
                let secondary = arr.get(1).as_string().unwrap_or_default();
                let key = arr.get(2).as_string().ok_or_else(|| js_err("entrée KV invalide".to_string()))?;
                let value_js = arr.get(3);
                if value_js.is_null() || value_js.is_undefined() {
                        continue;
                }
                let bytes = Uint8Array::from(value_js).to_vec();
                kv.load(&primary, &secondary, &key, bytes);
        }
        Ok(kv)
}

fn invoice_description(inv: &Bolt11Invoice) -> String {
        // Description or description hash, whichever the invoice carries.
        match inv.description() {
                lightning_invoice::Bolt11InvoiceDescriptionRef::Direct(desc) => desc.to_string(),
                lightning_invoice::Bolt11InvoiceDescriptionRef::Hash(_) => "(description hachée)".to_string(),
        }
}

/// KeysManager re-export guard: keeps `KeysManager` in scope for wasm-bindgen.
#[allow(dead_code)]
fn _assert_keys(_k: &KeysManager) {}
