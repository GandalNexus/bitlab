let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_3.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_3.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

const LnLabFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_lnlab_free(ptr >>> 0, 1));

export class LnLab {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(LnLab.prototype);
        obj.__wbg_ptr = ptr;
        LnLabFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LnLabFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_lnlab_free(ptr, 0);
    }
    /**
     * Current chain position of the lab (both nodes share the feed).
     * @returns {any}
     */
    best_block() {
        const ret = wasm.lnlab_best_block(this.__wbg_ptr);
        return ret;
    }
    /**
     * Boots two fresh nodes whose chain view starts at the current tip.
     * @param {string} network
     * @param {Uint8Array} seed_a
     * @param {Uint8Array} seed_b
     * @param {number} tip_height
     * @param {string} tip_hash
     * @param {number} now_secs
     * @returns {LnLab}
     */
    static boot_fresh(network, seed_a, seed_b, tip_height, tip_hash, now_secs) {
        const ptr0 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(seed_a, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(seed_b, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(tip_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_boot_fresh(ptr0, len0, ptr1, len1, ptr2, len2, tip_height, ptr3, len3, now_secs);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return LnLab.__wrap(ret[0]);
    }
    /**
     * Opens the in-memory P2P link A -> B (real noise handshake).
     */
    connect_ab() {
        const ret = wasm.lnlab_connect_ab(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Processes one chain block (hex) for both nodes; returns emitted events.
     * @param {number} height
     * @param {string} block_hex
     * @returns {Array<any>}
     */
    chain_block(height, block_hex) {
        const ptr0 = passStringToWasm0(block_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_chain_block(this.__wbg_ptr, height, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Pays a BOLT11 invoice over the direct channel (real HTLC, real routing).
     * @param {number} node
     * @param {string} invoice
     * @param {bigint | null} [amount_msat_override]
     */
    pay_invoice(node, invoice, amount_msat_override) {
        const ptr0 = passStringToWasm0(invoice, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_pay_invoice(this.__wbg_ptr, node, ptr0, len0, !isLikeNone(amount_msat_override), isLikeNone(amount_msat_override) ? BigInt(0) : amount_msat_override);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Boots two nodes from IndexedDB-backed state (KV entries + manager bytes).
     * @param {string} network
     * @param {Uint8Array} seed_a
     * @param {Uint8Array} seed_b
     * @param {number} now_secs
     * @param {Array<any>} kv_a
     * @param {Array<any>} kv_b
     * @returns {LnLab}
     */
    static boot_restore(network, seed_a, seed_b, now_secs, kv_a, kv_b) {
        const ptr0 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(seed_a, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(seed_b, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_boot_restore(ptr0, len0, ptr1, len1, ptr2, len2, now_secs, kv_a, kv_b);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return LnLab.__wrap(ret[0]);
    }
    /**
     * Creates a real BOLT12 offer (lno1…) on the selected node. The offer
     * carries a one-hop blinded message path back to the issuing node, so
     * any peer of that node can request an invoice through onion messages.
     * @param {number} node
     * @param {bigint | null | undefined} amount_msat
     * @param {string} description
     * @returns {string}
     */
    create_offer(node, amount_msat, description) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.lnlab_create_offer(this.__wbg_ptr, node, !isLikeNone(amount_msat), isLikeNone(amount_msat) ? BigInt(0) : amount_msat, ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Decodes a BOLT12 offer without touching any node state (static).
     * @param {string} offer
     * @returns {any}
     */
    static decode_offer(offer) {
        const ptr0 = passStringToWasm0(offer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_decode_offer(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * True while the in-memory P2P link is up.
     * @returns {boolean}
     */
    is_connected() {
        const ret = wasm.lnlab_is_connected(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Closes a channel cooperatively from the selected node.
     * @param {number} node
     * @param {string} channel_id_hex
     */
    close_channel(node, channel_id_hex) {
        const ptr0 = passStringToWasm0(channel_id_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_close_channel(this.__wbg_ptr, node, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Channel summary for the selected node.
     * @param {number} node
     * @returns {Array<any>}
     */
    list_channels(node) {
        const ret = wasm.lnlab_list_channels(this.__wbg_ptr, node);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Opens a channel from A to B. The funding transaction is built and signed
     * by the lab wallet in the main thread when `funding_generation_ready`
     * arrives, then handed back via `funding_transaction_generated`.
     * @param {bigint} value_sats
     * @param {bigint} push_msat
     * @param {bigint} user_channel_id
     */
    create_channel(value_sats, push_msat, user_channel_id) {
        const ret = wasm.lnlab_create_channel(this.__wbg_ptr, value_sats, push_msat, user_channel_id);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Creates and signs a real BOLT11 invoice on the selected node.
     * @param {number} node
     * @param {bigint | null | undefined} amount_msat
     * @param {string} description
     * @param {number} expiry_secs
     * @param {number} now_secs
     * @returns {string}
     */
    create_invoice(node, amount_msat, description, expiry_secs, now_secs) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(description, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.lnlab_create_invoice(this.__wbg_ptr, node, !isLikeNone(amount_msat), isLikeNone(amount_msat) ? BigInt(0) : amount_msat, ptr0, len0, expiry_secs, now_secs);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Decodes a BOLT11 invoice without touching any node state (static).
     * @param {string} invoice
     * @returns {any}
     */
    static decode_invoice(invoice) {
        const ptr0 = passStringToWasm0(invoice, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_decode_invoice(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Feeds back the funding transaction built by the lab wallet.
     * @param {bigint} user_channel_id
     * @param {string} tx_hex
     */
    funding_transaction_generated(user_channel_id, tx_hex) {
        const ptr0 = passStringToWasm0(tx_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_funding_transaction_generated(this.__wbg_ptr, user_channel_id, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Recent LDK log lines for the selected node (bounded tail).
     * @param {number} node
     * @returns {Array<any>}
     */
    logs(node) {
        const ret = wasm.lnlab_logs(this.__wbg_ptr, node);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Drives the protocol: message pump + pending events + persistence.
     * Returns the events emitted during this tick.
     * @returns {Array<any>}
     */
    tick() {
        const ret = wasm.lnlab_tick(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Compressed public key (node id) of the selected node, hex-encoded.
     * @param {number} node
     * @returns {string}
     */
    node_id(node) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.lnlab_node_id(this.__wbg_ptr, node);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Drains pending KV writes for both nodes: entries of
     * [nodeLabel, primary, secondary, key, Uint8Array | null].
     * @returns {Array<any>}
     */
    kv_dirty() {
        const ret = wasm.lnlab_kv_dirty(this.__wbg_ptr);
        return ret;
    }
    /**
     * Pushes fee rates (sat/kwu) converted from Esplora sat/vB by the worker.
     * @param {number} fast
     * @param {number} normal
     * @param {number} slow
     */
    set_fees(fast, normal, slow) {
        wasm.lnlab_set_fees(this.__wbg_ptr, fast, normal, slow);
    }
    /**
     * Pays a BOLT12 offer from the selected node: sends an invoice request
     * over onion messages, then pays the returned invoice over the direct
     * channel. The result surfaces later as normal payment events.
     * @param {number} node
     * @param {string} offer
     * @param {bigint | null} [amount_msat]
     * @param {string | null} [payer_note]
     */
    pay_offer(node, offer, amount_msat, payer_note) {
        const ptr0 = passStringToWasm0(offer, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(payer_note) ? 0 : passStringToWasm0(payer_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.lnlab_pay_offer(this.__wbg_ptr, node, ptr0, len0, !isLikeNone(amount_msat), isLikeNone(amount_msat) ? BigInt(0) : amount_msat, ptr1, len1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}

export function __wbg_buffer_609cc3eee51ed158(arg0) {
    const ret = arg0.buffer;
    return ret;
};

export function __wbg_error_7534b8e9a36f1ab4(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
    }
};

export function __wbg_from_2a5d3e218e67aa85(arg0) {
    const ret = Array.from(arg0);
    return ret;
};

export function __wbg_get_b9b93047fe3cf45b(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
};

export function __wbg_hostBroadcast_fdd66d50f259a190(arg0, arg1, arg2, arg3) {
    lnlabHost.hostBroadcast(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
};

export function __wbg_hostLog_415529357ef4bfe8(arg0, arg1, arg2) {
    lnlabHost.hostLog(arg0, getStringFromWasm0(arg1, arg2));
};

export function __wbg_length_a446193dc22c12f8(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_length_e2d2a49132c1b256(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_new_405e22f390576ce2() {
    const ret = new Object();
    return ret;
};

export function __wbg_new_78feb108b6472713() {
    const ret = new Array();
    return ret;
};

export function __wbg_new_8a6f238a6ece86ea() {
    const ret = new Error();
    return ret;
};

export function __wbg_new_a12002a7f91c75be(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
};

export function __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a(arg0, arg1, arg2) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
};

export function __wbg_push_737cfc8c1432c2c6(arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
};

export function __wbg_set_65595bdd868b3009(arg0, arg1, arg2) {
    arg0.set(arg1, arg2 >>> 0);
};

export function __wbg_set_bb8cecf6a62b9f46() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
}, arguments) };

export function __wbg_stack_0ed75d68575b0f3c(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_debug_string(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_3;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

export function __wbindgen_is_null(arg0) {
    const ret = arg0 === null;
    return ret;
};

export function __wbindgen_is_undefined(arg0) {
    const ret = arg0 === undefined;
    return ret;
};

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return ret;
};

export function __wbindgen_string_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_string_new(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

