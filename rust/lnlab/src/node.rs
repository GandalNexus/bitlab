//! BitLab lnlab — one full LDK node and its wiring.
//!
//! Exactly the wiring recommended by the LDK 0.2 "build a node" documentation,
//! with two lab-specific simplifications:
//!  - `DirectRouter`: the lab only ever routes over the direct A-to-B channel,
//!    so `find_route` builds the single-hop route by hand. This also avoids
//!    `NetworkGraph` and LDK's private lock types entirely. It also builds the
//!    one-hop blinded payment paths BOLT12 invoices need (introduction node =
//!    the payee itself, which is always the direct counterparty here).
//!  - `LabMessageRouter`: onion messages only ever go to the connected peer,
//!    so `find_path` answers with a direct path when the destination (clear or
//!    blinded) resolves to that peer, and `create_blinded_paths` builds a
//!    one-hop blinded message path. This is what makes BOLT12 offers work —
//!    invoice requests and invoices travel inside onion messages.
//!
//! The crate is compiled without the `std` feature so that LDK never touches a
//! wall clock (wasm32 has none) and derives time from parameters passed by
//! JavaScript.

use std::sync::Arc;

use bitcoin::secp256k1::PublicKey;
use lightning::blinded_path::message::{BlindedMessagePath, MessageContext, MessageForwardNode};
use lightning::blinded_path::payment::{BlindedPaymentPath, ReceiveTlvs};
use lightning::blinded_path::IntroductionNode;
use lightning::chain::chainmonitor::ChainMonitor;
use lightning::chain::BestBlock;
use lightning::ln::channelmanager::{ChannelManager, ChannelManagerReadArgs, ChainParameters};
use lightning::ln::channel_state::ChannelDetails;
use lightning::ln::peer_handler::{IgnoringMessageHandler, MessageHandler, PeerManager};
use lightning::onion_message::messenger::{
        Destination, MessageRouter, OnionMessagePath, OnionMessenger,
};
use lightning::routing::router::{
        BlindedTail, InFlightHtlcs, Payee, Path, Route, RouteHop, Router, RouteParameters,
};
use lightning::sign::{
        EntropySource as _, InMemorySigner, KeysManager, NodeSigner as _, ReceiveAuthKey,
};
use lightning::types::features::{ChannelFeatures, NodeFeatures};
use lightning::util::config::UserConfig;
use lightning::util::persist::{read_channel_monitors, KVStoreSync as _};
use lightning::util::ser::ReadableArgs;

use crate::chainio::{FeeRates, JsBroadcaster, JsFeeEstimator, JsLogger, NoFilter};
use crate::sockets::LnSocket;
use crate::store::SharedKv;

// ---------------------------------------------------------------------------
// Type aliases — ChannelManager carries nine generics; spell them once.
// ---------------------------------------------------------------------------

pub(crate) type LoggerArc = Arc<JsLogger>;
pub(crate) type FeeArc = std::rc::Rc<JsFeeEstimator>;
pub(crate) type BcArc = std::rc::Rc<JsBroadcaster>;
pub(crate) type KeysArc = Arc<KeysManager>;
pub(crate) type RouterArc = Arc<DirectRouter>;
pub(crate) type MsgRouterArc = Arc<LabMessageRouter>;
pub(crate) type IgnArc = Arc<IgnoringMessageHandler>;
/// The onion messenger: entropy + signer come from the keys manager, the node
/// id lookup and the BOLT12 offers handler both live in the channel manager.
pub(crate) type OmArc = Arc<
        OnionMessenger<KeysArc, KeysArc, LoggerArc, CmArc, MsgRouterArc, CmArc, IgnArc, IgnArc, IgnArc>,
>;
pub(crate) type MonitorArc =
        Arc<ChainMonitor<InMemorySigner, Arc<NoFilter>, BcArc, FeeArc, LoggerArc, SharedKv, KeysArc>>;
pub(crate) type CmArc =
        Arc<ChannelManager<MonitorArc, BcArc, KeysArc, KeysArc, KeysArc, FeeArc, RouterArc, MsgRouterArc, LoggerArc>>;
pub(crate) type PmArc = Arc<
        PeerManager<
                LnSocket,
                CmArc,
                IgnArc,
                OmArc,
                LoggerArc,
                IgnArc,
                KeysArc,
                MonitorArc,
        >,
>;

/// Finds the direct channel to a counterparty (the lab's only route shape).
fn direct_channel<'a>(
        first_hops: &'a [&'a ChannelDetails], payee: &PublicKey,
) -> Result<&'a ChannelDetails, &'static str> {
        first_hops
                .iter()
                .find(|d| d.counterparty.node_id == *payee && d.is_usable)
                .copied()
                .ok_or("aucun canal direct utilisable vers le destinataire")
}

fn channel_scid(channel: &ChannelDetails) -> Result<u64, &'static str> {
        channel
                .short_channel_id
                .or(channel.outbound_scid_alias)
                .or(channel.inbound_scid_alias)
                .ok_or("identifiant de canal indisponible")
}

/// CLTV minimum du dernier hop.
///
/// Les factures demandent souvent 18 blocs, mais un receveur LDK refuse tout
/// HTLC dont l'expiration est plus proche que `HTLC_FAIL_BACK_BUFFER` (39
/// blocs : marge de diffusion on-chain incluse — erreur « final CLTV expiry
/// is too soon », code 0x400f). Le routeur aligne donc le CLTV envoyé sur la
/// marge du receveur plus un coussin, quel que soit le delta annoncé.
const FINAL_CLTV_MIN: u32 = lightning::chain::channelmonitor::HTLC_FAIL_BACK_BUFFER + 21;

/// Routes every payment over the direct channel to the payee (single hop).
///
/// Correct by construction for the lab: the only channel that can exist is
/// A-to-B, and LDK hands us the payer's usable channels as `first_hops`.
/// BOLT12 invoices carry a blinded payment path whose introduction node is the
/// payee itself, so the blinded case resolves to the same direct channel.
pub(crate) struct DirectRouter {
        /// Entropy source for the blinding secrets of payment paths we build.
        pub keys: KeysArc,
}

impl Router for DirectRouter {
        fn find_route(
                &self, _payer: &PublicKey, route_params: &RouteParameters,
                first_hops: Option<&[&ChannelDetails]>, _inflight: InFlightHtlcs,
        ) -> Result<Route, &'static str> {
                let hops = first_hops.ok_or("aucun canal fourni au routeur")?;
                let (payee, final_cltv, blinded_tail) = match &route_params.payment_params.payee {
                        Payee::Clear { node_id, final_cltv_expiry_delta, .. } => {
                                (*node_id, *final_cltv_expiry_delta, None)
                        },
                        Payee::Blinded { route_hints, .. } => {
                                let path = route_hints.first().ok_or("aucun chemin aveugle fourni")?;
                                let intro = match path.introduction_node() {
                                        IntroductionNode::NodeId(id) => *id,
                                        IntroductionNode::DirectedShortChannelId(..) => {
                                                return Err("introduction par scid non supportée dans le labo")
                                        },
                                };
                                // One-hop blinded path built by ourselves: the tail
                                // is the payee in disguise, the channel is the same.
                                let tail = BlindedTail {
                                        trampoline_hops: Vec::new(),
                                        hops: path.blinded_hops().to_vec(),
                                        blinding_point: path.blinding_point(),
                                        excess_final_cltv_expiry_delta: 0,
                                        final_value_msat: route_params.final_value_msat,
                                };
                                (intro, path.payinfo.cltv_expiry_delta.max(18) as u32, Some(tail))
                        },
                };
                let channel = direct_channel(hops, &payee)?;
                let hop = RouteHop {
                        pubkey: payee,
                        node_features: NodeFeatures::empty(),
                        short_channel_id: channel_scid(channel)?,
                        channel_features: ChannelFeatures::empty(),
                        // Clear route: the last hop carries the full payment
                        // value (its "fee" is the amount delivered). Blinded
                        // route: the tail already carries the final value, so
                        // any fee here would be added on top and double the
                        // HTLC (15 000 msat offered were paid 30 000 msat).
                        fee_msat: if blinded_tail.is_some() {
                                0
                        } else {
                                route_params.final_value_msat
                        },
                        cltv_expiry_delta: final_cltv.max(FINAL_CLTV_MIN),
                        maybe_announced_channel: false,
                };
                Ok(Route {
                        paths: vec![Path { hops: vec![hop], blinded_tail }],
                        route_params: Some(route_params.clone()),
                })
        }

        /// Builds the one-hop blinded payment path embedded in BOLT12 invoices
        /// we issue: introduction node = us, single blinded hop = us.
        fn create_blinded_payment_paths<T: bitcoin::secp256k1::Signing + bitcoin::secp256k1::Verification>(
                &self, recipient: PublicKey, _first_hops: Vec<ChannelDetails>,
                tlvs: ReceiveTlvs, _amount_msats: Option<u64>,
                secp_ctx: &bitcoin::secp256k1::Secp256k1<T>,
        ) -> Result<Vec<BlindedPaymentPath>, ()> {
                Ok(vec![BlindedPaymentPath::one_hop(
                        recipient, tlvs, 18, Arc::clone(&self.keys), secp_ctx,
                )?])
        }
}

/// Onion-message routing for the lab: the only possible destination is the
/// connected peer. Blinded destinations resolve because our one-hop paths use
/// the recipient's node id as introduction node.
pub(crate) struct LabMessageRouter {
        /// Entropy source for the blinding secrets of message paths we build.
        pub keys: KeysArc,
}

impl MessageRouter for LabMessageRouter {
        fn find_path(&self, _sender: PublicKey, peers: Vec<PublicKey>, destination: Destination) -> Result<OnionMessagePath, ()> {
                let reachable = |node_id: &PublicKey| peers.contains(node_id);
                let direct = match &destination {
                        Destination::Node(node_id) => reachable(node_id),
                        Destination::BlindedPath(path) => match path.introduction_node() {
                                IntroductionNode::NodeId(node_id) => reachable(node_id),
                                IntroductionNode::DirectedShortChannelId(..) => false,
                        },
                };
                if direct {
                        Ok(OnionMessagePath {
                                intermediate_nodes: Vec::new(),
                                destination,
                                first_node_addresses: Vec::new(),
                        })
                } else {
                        Err(())
                }
        }

        /// Builds the one-hop blinded message path offers carry: introduction
        /// node = us, single blinded hop = us.
        fn create_blinded_paths<T: bitcoin::secp256k1::Signing + bitcoin::secp256k1::Verification>(
                &self, recipient: PublicKey, receive_key: ReceiveAuthKey, context: MessageContext,
                _peers: Vec<MessageForwardNode>, secp_ctx: &bitcoin::secp256k1::Secp256k1<T>,
        ) -> Result<Vec<BlindedMessagePath>, ()> {
                Ok(vec![BlindedMessagePath::one_hop(
                        recipient, receive_key, context, Arc::clone(&self.keys), secp_ctx,
                )])
        }
}

pub(crate) struct LnNode {
        pub keys: KeysArc,
        pub logger: LoggerArc,
        pub fee: FeeArc,
        pub kv: SharedKv,
        pub monitor: MonitorArc,
        pub cm: CmArc,
        pub pm: PmArc,
}

/// Construction parameters shared by the fresh and restore paths.
pub(crate) struct NodeParts {
        pub seed: [u8; 32],
        pub fees: FeeRates,
        pub network: bitcoin::Network,
        pub kv: SharedKv,
        pub now_secs: u32,
        pub now_nanos: u32,
}

pub(crate) fn network_slug(network: bitcoin::Network) -> &'static str {
        match network {
                bitcoin::Network::Testnet => "testnet3",
                bitcoin::Network::Signet => "signet",
                bitcoin::Network::Bitcoin => "mainnet",
                bitcoin::Network::Regtest => "regtest",
                _ => "unknown",
        }
}

/// Builds a brand-new node whose chain view starts at the current Esplora tip.
pub(crate) fn build_fresh(parts: &NodeParts, best_block: BestBlock) -> LnNode {
        let keys = Arc::new(KeysManager::new(&parts.seed, parts.now_secs as u64, parts.now_nanos, false));
        let logger = Arc::new(JsLogger::new());
        let fee = std::rc::Rc::new(JsFeeEstimator::new(parts.fees));
        let broadcaster = std::rc::Rc::new(JsBroadcaster { network: network_slug(parts.network).to_string() });
        let monitor = Arc::new(ChainMonitor::new(
                None::<Arc<NoFilter>>,
                std::rc::Rc::clone(&broadcaster),
                Arc::clone(&logger),
                std::rc::Rc::clone(&fee),
                std::rc::Rc::clone(&parts.kv),
                Arc::clone(&keys),
                keys.get_peer_storage_key(),
        ));
        let cm = Arc::new(ChannelManager::new(
                std::rc::Rc::clone(&fee),
                Arc::clone(&monitor),
                std::rc::Rc::clone(&broadcaster),
                Arc::new(DirectRouter { keys: Arc::clone(&keys) }),
                Arc::new(LabMessageRouter { keys: Arc::clone(&keys) }),
                Arc::clone(&logger),
                Arc::clone(&keys),
                Arc::clone(&keys),
                Arc::clone(&keys),
                UserConfig::default(),
                ChainParameters { network: parts.network, best_block },
                parts.now_secs,
        ));
        let pm = build_peer_manager(&keys, &logger, &monitor, Arc::clone(&cm));
        LnNode { keys, logger, fee, kv: std::rc::Rc::clone(&parts.kv), monitor, cm, pm }
}
/// Restores a node from persisted state (manager + monitors already in `kv`).
pub(crate) fn build_restored(parts: &NodeParts) -> Result<LnNode, String> {
        let keys = Arc::new(KeysManager::new(&parts.seed, parts.now_secs as u64, parts.now_nanos, false));
        let logger = Arc::new(JsLogger::new());
        let fee = std::rc::Rc::new(JsFeeEstimator::new(parts.fees));
        let broadcaster = std::rc::Rc::new(JsBroadcaster { network: network_slug(parts.network).to_string() });
        let monitor = Arc::new(ChainMonitor::new(
                None::<Arc<NoFilter>>,
                std::rc::Rc::clone(&broadcaster),
                Arc::clone(&logger),
                std::rc::Rc::clone(&fee),
                std::rc::Rc::clone(&parts.kv),
                Arc::clone(&keys),
                keys.get_peer_storage_key(),
        ));

        // Monitors are read straight from the KV store, exactly like ldk-sample.
        let monitors = read_channel_monitors(
                std::rc::Rc::clone(&parts.kv),
                Arc::clone(&keys),
                Arc::clone(&keys),
        )
        .map_err(|e| format!("lecture des moniteurs: {}", e))?;

        let read_args = ChannelManagerReadArgs::new(
                Arc::clone(&keys),
                Arc::clone(&keys),
                Arc::clone(&keys),
                std::rc::Rc::clone(&fee),
                Arc::clone(&monitor),
                std::rc::Rc::clone(&broadcaster),
                Arc::new(DirectRouter { keys: Arc::clone(&keys) }),
                Arc::new(LabMessageRouter { keys: Arc::clone(&keys) }),
                Arc::clone(&logger),
                UserConfig::default(),
                monitors.iter().map(|(_, monitor)| monitor).collect(),
        );
        let manager_bytes = parts
                .kv
                .read("", "", "manager")
                .map_err(|e| format!("manager absent du stockage: {}", e))?;
        let (_best_hash, cm) =
                <(bitcoin::BlockHash, ChannelManager<MonitorArc, BcArc, KeysArc, KeysArc, KeysArc, FeeArc, RouterArc, MsgRouterArc, LoggerArc>)>::read(
                        &mut &manager_bytes[..], read_args,
                )
                .map_err(|e| format!("lecture du channel manager: {:?}", e))?;
        let cm = Arc::new(cm);
        let pm = build_peer_manager(&keys, &logger, &monitor, Arc::clone(&cm));
        Ok(LnNode { keys, logger, fee, kv: std::rc::Rc::clone(&parts.kv), monitor, cm, pm })
}

fn build_peer_manager(keys: &KeysArc, logger: &LoggerArc, monitor: &MonitorArc, cm: CmArc) -> PmArc {
        let ephemeral = keys.get_secure_random_bytes();
        // The channel manager implements both the BOLT12 offers handler and the
        // node id lookup the onion messenger needs — one Arc, two hats.
        let messenger = OnionMessenger::new(
                Arc::clone(keys),
                Arc::clone(keys),
                Arc::clone(logger),
                Arc::clone(&cm),
                Arc::new(LabMessageRouter { keys: Arc::clone(keys) }),
                Arc::clone(&cm),
                Arc::new(IgnoringMessageHandler {}),
                Arc::new(IgnoringMessageHandler {}),
                Arc::new(IgnoringMessageHandler {}),
        );
        let message_handler = MessageHandler {
                chan_handler: cm,
                route_handler: Arc::new(IgnoringMessageHandler {}),
                onion_message_handler: Arc::new(messenger),
                custom_message_handler: Arc::new(IgnoringMessageHandler {}),
                send_only_message_handler: Arc::clone(monitor),
        };
        Arc::new(PeerManager::new(
                message_handler,
                0, // current_time; pings are irrelevant on an in-memory link
                &ephemeral,
                Arc::clone(logger),
                Arc::clone(keys),
        ))
}
