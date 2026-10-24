//! BitLab lnlab — LDK persistence backed by JavaScript (IndexedDB).
//!
//! LDK 0.2 writes every channel monitor update synchronously through the
//! `KVStoreSync` trait. On the web, IndexedDB is asynchronous, so we keep an
//! in-memory map plus a dirty set; the worker drains the dirty set after every
//! tick and flushes it to IndexedDB. Loss on tab crash is bounded to the last
//! flush interval and only affects already-persisted-on-chain data recovery,
//! which LDK re-derives from the chain feed.

use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::rc::Rc;

use lightning::io;
use lightning::util::persist::KVStoreSync;
use wasm_bindgen::prelude::*;

pub(crate) type StoreKey = (String, String, String);

pub(crate) struct JsKvStore {
        data: RefCell<HashMap<StoreKey, Vec<u8>>>,
        dirty: RefCell<BTreeSet<StoreKey>>,
        dropped: RefCell<BTreeSet<StoreKey>>,
}

impl JsKvStore {
        pub(crate) fn new() -> Self {
                Self {
                        data: RefCell::new(HashMap::new()),
                        dirty: RefCell::new(BTreeSet::new()),
                        dropped: RefCell::new(BTreeSet::new()),
                }
        }

        pub(crate) fn load(&self, primary: &str, secondary: &str, key: &str, value: Vec<u8>) {
                self.data
                        .borrow_mut()
                        .insert((primary.to_string(), secondary.to_string(), key.to_string()), value);
        }

        pub(crate) fn take_dirty(&self) -> Vec<(StoreKey, Option<Vec<u8>>)> {
                let mut out = Vec::new();
                let dirty_keys: Vec<StoreKey> = self.dirty.borrow().iter().cloned().collect();
                self.dirty.borrow_mut().clear();
                for key in dirty_keys {
                        let value = self.data.borrow().get(&key).cloned();
                        out.push((key, value));
                }
                let dropped_keys: Vec<StoreKey> = self.dropped.borrow().iter().cloned().collect();
                self.dropped.borrow_mut().clear();
                for key in dropped_keys {
                        // Only report a tombstone if the key is really gone.
                        if !self.data.borrow().contains_key(&key) {
                                out.push((key, None));
                        }
                }
                out
        }
}

fn err_not_found() -> io::Error {
        io::Error::new(io::ErrorKind::NotFound, "key not found".to_string())
}

impl KVStoreSync for JsKvStore {
        fn read(&self, primary_namespace: &str, secondary_namespace: &str, key: &str) -> Result<Vec<u8>, io::Error> {
                self.data
                        .borrow()
                        .get(&(
                                primary_namespace.to_string(),
                                secondary_namespace.to_string(),
                                key.to_string(),
                        ))
                        .cloned()
                        .ok_or_else(err_not_found)
        }

        fn write(
                &self, primary_namespace: &str, secondary_namespace: &str, key: &str, buf: Vec<u8>,
        ) -> Result<(), io::Error> {
                let full = (primary_namespace.to_string(), secondary_namespace.to_string(), key.to_string());
                self.data.borrow_mut().insert(full.clone(), buf);
                self.dropped.borrow_mut().remove(&full);
                self.dirty.borrow_mut().insert(full);
                Ok(())
        }

        fn remove(
                &self, primary_namespace: &str, secondary_namespace: &str, key: &str, _lazy: bool,
        ) -> Result<(), io::Error> {
                let full = (primary_namespace.to_string(), secondary_namespace.to_string(), key.to_string());
                self.data.borrow_mut().remove(&full);
                self.dropped.borrow_mut().insert(full.clone());
                self.dirty.borrow_mut().remove(&full);
                Ok(())
        }

        fn list(&self, primary_namespace: &str, secondary_namespace: &str) -> Result<Vec<String>, io::Error> {
                let mut keys: Vec<String> = self
                        .data
                        .borrow()
                        .keys()
                        .filter(|(p, s, _)| p == primary_namespace && s == secondary_namespace)
                        .map(|(_, _, k)| k.clone())
                        .collect();
                keys.sort();
                Ok(keys)
        }
}

/// Shared per-node store handed to LDK components as `Rc<JsKvStore>`.
pub(crate) type SharedKv = Rc<JsKvStore>;

pub(crate) fn shared_store() -> SharedKv {
        Rc::new(JsKvStore::new())
}

#[allow(dead_code)]
pub(crate) fn kv_error_to_js(error: &io::Error) -> JsValue {
        JsValue::from_str(&format!("kv error: {}", error))
}
