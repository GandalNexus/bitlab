//! BitLab lnlab — in-memory linked sockets between node A and node B.
//!
//! LDK's `PeerManager` is transport-agnostic: anything implementing
//! `SocketDescriptor` works. The two lab nodes live in the same worker, so the
//! "network link" is a pair of cross-referenced queues. Every Lightning message
//! (noise handshake, channel negotiation, HTLCs, commitment signatures) is real
//! protocol data — only the transport is a memory pipe.

use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;

use lightning::ln::peer_handler::SocketDescriptor;

/// One endpoint of the link. `Eq`/`Hash` are derived from the side so that the
/// `PeerManager` internal maps treat clones of the same endpoint as one peer.
#[derive(Clone)]
pub(crate) struct LnSocket {
        side: u8,
        /// The other side's inbox: `send_data` pushes there.
        peer_inbox: Rc<RefCell<VecDeque<Vec<u8>>>>,
        open: Rc<RefCell<bool>>,
}

impl PartialEq for LnSocket {
        fn eq(&self, other: &Self) -> bool {
                self.side == other.side
        }
}

impl Eq for LnSocket {}

impl std::hash::Hash for LnSocket {
        fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
                self.side.hash(state);
        }
}

pub(crate) struct Link {
        pub inbox_a: Rc<RefCell<VecDeque<Vec<u8>>>>,
        pub inbox_b: Rc<RefCell<VecDeque<Vec<u8>>>>,
        pub open: Rc<RefCell<bool>>,
}

impl LnSocket {
        /// Creates a linked pair (A endpoint, B endpoint).
        pub(crate) fn pair() -> (LnSocket, LnSocket, Link) {
                let inbox_a = Rc::new(RefCell::new(VecDeque::new()));
                let inbox_b = Rc::new(RefCell::new(VecDeque::new()));
                let open = Rc::new(RefCell::new(true));
                let a = LnSocket {
                        side: 0,
                        peer_inbox: Rc::clone(&inbox_b),
                        open: Rc::clone(&open),
                };
                let b = LnSocket {
                        side: 1,
                        peer_inbox: Rc::clone(&inbox_a),
                        open,
                };
                let link = Link { inbox_a, inbox_b, open: a.open.clone() };
                (a, b, link)
        }

        pub(crate) fn is_open(&self) -> bool {
                *self.open.borrow()
        }

        pub(crate) fn disconnect_both(&self) {
                *self.open.borrow_mut() = false;
        }
}

impl SocketDescriptor for LnSocket {
        fn send_data(&mut self, data: &[u8], _resume_read: bool) -> usize {
                if !self.is_open() || data.is_empty() {
                        return 0;
                }
                self.peer_inbox.borrow_mut().push_back(data.to_vec());
                data.len()
        }

        fn disconnect_socket(&mut self) {
                self.disconnect_both();
        }
}
