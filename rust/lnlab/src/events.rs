//! BitLab lnlab — serialization of LDK `Event`s into JavaScript objects.
//!
//! The worker receives a flat array of `{ node, type, ...fields }` records and
//! maps them onto i18n keys in the UI. Only lab-relevant variants carry fields;
//! everything else is surfaced with its variant name so nothing is silently
//! dropped.

use js_sys::{Array, Object};
use lightning::events::Event;
use wasm_bindgen::JsValue;
pub(crate) fn event_to_js(node_label: &str, event: &Event) -> JsValue {
        let obj = Object::new();
        set(&obj, "node", node_label);
        match event {
                Event::FundingGenerationReady {
                        temporary_channel_id,
                        counterparty_node_id,
                        channel_value_satoshis,
                        output_script,
                        user_channel_id,
                } => {
                        set(&obj, "type", "funding_generation_ready");
                        set(&obj, "temporaryChannelId", &temporary_channel_id.to_string());
                        set(&obj, "counterparty", &counterparty_node_id.to_string());
                        set(&obj, "valueSats", &channel_value_satoshis.to_string());
                        set(&obj, "outputScript", &output_script.to_hex_string());
                        set(&obj, "userChannelId", &(*user_channel_id as u64).to_string());
                },
                Event::ChannelPending { channel_id, counterparty_node_id, funding_txo, .. } => {
                        set(&obj, "type", "channel_pending");
                        set(&obj, "channelId", &channel_id.to_string());
                        set(&obj, "counterparty", &counterparty_node_id.to_string());
                        set(&obj, "fundingTxo", &funding_txo.to_string());
                },
                Event::ChannelReady { channel_id, counterparty_node_id, .. } => {
                        set(&obj, "type", "channel_ready");
                        set(&obj, "channelId", &channel_id.to_string());
                        set(&obj, "counterparty", &counterparty_node_id.to_string());
                },
                Event::ChannelClosed { channel_id, reason, .. } => {
                        set(&obj, "type", "channel_closed");
                        set(&obj, "channelId", &channel_id.to_string());
                        set(&obj, "reason", &format!("{:?}", reason));
                },
                Event::PaymentClaimable { payment_hash, amount_msat, .. } => {
                        set(&obj, "type", "payment_claimable");
                        set(&obj, "paymentHash", &hex32(payment_hash.0));
                        set(&obj, "amountMsat", &amount_msat.to_string());
                },
                Event::PaymentClaimed { payment_hash, amount_msat, .. } => {
                        set(&obj, "type", "payment_claimed");
                        set(&obj, "paymentHash", &hex32(payment_hash.0));
                        set(&obj, "amountMsat", &amount_msat.to_string());
                },
                Event::PaymentSent { payment_preimage, payment_hash, amount_msat, fee_paid_msat, .. } => {
                        set(&obj, "type", "payment_sent");
                        set(&obj, "preimage", &hex32(payment_preimage.0));
                        set(&obj, "paymentHash", &hex32(payment_hash.0));
                        if let Some(amount) = amount_msat {
                                set(&obj, "amountMsat", &amount.to_string());
                        }
                        if let Some(fee) = fee_paid_msat {
                                set(&obj, "feeMsat", &fee.to_string());
                        }
                },
                Event::PaymentFailed { payment_hash, reason, .. } => {
                        set(&obj, "type", "payment_failed");
                        if let Some(hash) = payment_hash {
                                set(&obj, "paymentHash", &hex32(hash.0));
                        }
                        if let Some(reason) = reason {
                                set(&obj, "reason", &format!("{:?}", reason));
                        }
                },
                Event::PaymentPathFailed { payment_failed_permanently, .. } => {
                        set(&obj, "type", "payment_path_failed");
                        set(&obj, "permanent", &payment_failed_permanently.to_string());
                },
                Event::DiscardFunding { channel_id, .. } => {
                        set(&obj, "type", "discard_funding");
                        set(&obj, "channelId", &channel_id.to_string());
                },
                Event::SpendableOutputs { outputs, .. } => {
                        set(&obj, "type", "spendable_outputs");
                        set(&obj, "count", &outputs.len().to_string());
                },
                Event::OpenChannelRequest { temporary_channel_id, counterparty_node_id, funding_satoshis, .. } => {
                        set(&obj, "type", "open_channel_request");
                        set(&obj, "temporaryChannelId", &temporary_channel_id.to_string());
                        set(&obj, "counterparty", &counterparty_node_id.to_string());
                        set(&obj, "valueSats", &funding_satoshis.to_string());
                },
                Event::HTLCHandlingFailed { failure_type, .. } => {
                        set(&obj, "type", "htlc_handling_failed");
                        set(&obj, "detail", &format!("{:?}", failure_type));
                },
                other => {
                        set(&obj, "type", "other");
                        set(&obj, "detail", &format!("{:?}", std::mem::discriminant(other)));
                },
        }
        obj.into()
}

pub(crate) fn events_to_array(items: Vec<JsValue>) -> Array {
        items.into_iter().collect()
}

fn set(obj: &Object, key: &str, value: &str) {
        js_sys::Reflect::set(obj, &JsValue::from_str(key), &JsValue::from_str(value))
                .expect("set property");
}

fn hex32(bytes: [u8; 32]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Local hex helper for script bytes (ScriptBuf implements Display as hex, but
/// keep an explicit path independent of formatting defaults).
trait ToHexString {
        fn to_hex_string(&self) -> String;
}

impl ToHexString for bitcoin::ScriptBuf {
        fn to_hex_string(&self) -> String {
                self.as_bytes().iter().map(|b| format!("{:02x}", b)).collect()
        }
}
