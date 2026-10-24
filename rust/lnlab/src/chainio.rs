//! BitLab lnlab — host-side plumbing for LDK: logger, fee estimator, broadcaster.
//!
//! All chain I/O is delegated to JavaScript (same-origin proxy `/api/bitcoin`),
//! because `mempool.space` does not send CORS headers and the worker must not
//! talk to the network directly. No clock API is ever used: wasm32-unknown-unknown
//! has no wall clock (`Instant::now` traps), so timestamps are always provided
//! by JavaScript.

use std::cell::RefCell;

use bitcoin::consensus::encode::serialize;
use bitcoin::hex::DisplayHex;
use bitcoin::Transaction;
use lightning::chain::chaininterface::{
        BroadcasterInterface, ConfirmationTarget, FeeEstimator,
};
use lightning::util::logger::{Level, Logger, Record};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
        #[wasm_bindgen(js_namespace = lnlabHost)]
        fn hostLog(level: u8, message: &str);
        #[wasm_bindgen(js_namespace = lnlabHost)]
        fn hostBroadcast(network: &str, tx_hex: &str);
}

pub(crate) struct JsLogger {
        pub tail: RefCell<Vec<(u8, String)>>,
}

impl JsLogger {
        pub(crate) fn new() -> Self {
                Self { tail: RefCell::new(Vec::new()) }
        }
}

impl Logger for JsLogger {
        fn log(&self, record: Record) {
                let level = match record.level {
                        Level::Gossip => 0u8,
                        Level::Trace => 1,
                        Level::Debug => 2,
                        Level::Info => 3,
                        Level::Warn => 4,
                        Level::Error => 5,
                };
                let message = record.args.to_string();
                if message.len() > 400 {
                        let truncated: String = message.chars().take(400).collect();
                        self.push(level, truncated.clone());
                        hostLog(level, &truncated);
                } else {
                        self.push(level, message.clone());
                        hostLog(level, &message);
                }
        }
}

impl JsLogger {
        fn push(&self, level: u8, message: String) {
                let mut tail = self.tail.borrow_mut();
                tail.insert(0, (level, message));
                tail.truncate(80);
        }

        pub(crate) fn tail_strings(&self) -> Vec<String> {
                self.tail
                        .borrow()
                        .iter()
                        .map(|(lvl, msg)| format!("[{}] {}", level_tag(*lvl), msg))
                        .collect()
        }
}

fn level_tag(level: u8) -> &'static str {
        match level {
                4 => "WARN",
                5 => "ERROR",
                _ => "INFO",
        }
}

#[derive(Clone, Copy)]
pub(crate) struct FeeRates {
        pub fast: u32,
        pub normal: u32,
        pub slow: u32,
}

pub(crate) struct JsFeeEstimator {
        pub rates: RefCell<FeeRates>,
}

impl JsFeeEstimator {
        pub(crate) fn new(rates: FeeRates) -> Self {
                Self { rates: RefCell::new(rates) }
        }

        pub(crate) fn set_rates(&self, rates: FeeRates) {
                *self.rates.borrow_mut() = rates;
        }
}

impl FeeEstimator for JsFeeEstimator {
        fn get_est_sat_per_1000_weight(&self, confirmation_target: ConfirmationTarget) -> u32 {
                let rates = *self.rates.borrow();
                let floor = 253u32;
                match confirmation_target {
                        ConfirmationTarget::UrgentOnChainSweep | ConfirmationTarget::MaximumFeeEstimate => {
                                rates.fast.max(floor)
                        },
                        ConfirmationTarget::AnchorChannelFee | ConfirmationTarget::OutputSpendingFee => {
                                rates.normal.max(floor)
                        },
                        ConfirmationTarget::NonAnchorChannelFee => rates.normal.max(floor),
                        ConfirmationTarget::MinAllowedAnchorChannelRemoteFee => floor,
                        ConfirmationTarget::MinAllowedNonAnchorChannelRemoteFee => rates.slow.max(floor),
                        ConfirmationTarget::ChannelCloseMinimum => rates.slow.max(floor),
                }
        }
}

/// Forwards transactions to JavaScript, which broadcasts them through the
/// same-origin Esplora proxy (`POST /api/bitcoin?path=tx`). Fire-and-forget:
/// delivery issues are surfaced to the student in the UI, not to LDK.
pub(crate) struct JsBroadcaster {
        pub network: String,
}

impl BroadcasterInterface for JsBroadcaster {
        fn broadcast_transactions(&self, txs: &[&Transaction]) {
                for tx in txs {
                        let raw = serialize(*tx);
                        let hex = raw.as_hex().to_string();
                        hostLog(3, &format!("broadcast tx {}", hex.get(0..16).unwrap_or("")));
                        hostBroadcast(&self.network, &hex);
                }
        }
}

/// Unused chain filter: we feed full blocks to both `ChannelManager` and
/// `ChainMonitor`, so LDK never needs to request filtered data.
pub(crate) struct NoFilter;

impl lightning::chain::Filter for NoFilter {
        fn register_tx(&self, _txid: &bitcoin::Txid, _script_pubkey: &bitcoin::Script) {}
        fn register_output(&self, _output: lightning::chain::WatchedOutput) {}
}
