#!/usr/bin/env bash
set -euo pipefail

WASM_BINDGEN_VERSION=0.2.100

cd "$(dirname "$0")/../rust/lnlab"

command -v wasm-bindgen >/dev/null 2>&1 || {
        echo "wasm-bindgen-cli ${WASM_BINDGEN_VERSION} requis : cargo install wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION} --locked" >&2
        exit 1
}

rustup target add wasm32-unknown-unknown

cargo build --release --target wasm32-unknown-unknown

rm -rf target/wbindgen-out
wasm-bindgen --target no-modules \
        --out-dir target/wbindgen-out \
        target/wasm32-unknown-unknown/release/lnlab.wasm

OUT=../../public/lnlab
cp target/wbindgen-out/lnlab_bg.wasm      "$OUT/lnlab_bg.wasm"
cp target/wbindgen-out/lnlab_bg.wasm.d.ts "$OUT/lnlab_bg.wasm.d.ts"
cp target/wbindgen-out/lnlab.d.ts         "$OUT/lnlab.d.ts"
cp target/wbindgen-out/lnlab.js           "$OUT/lnlab_bg.js"
printf '\nexport default wasm_bindgen;\n' >> "$OUT/lnlab_bg.js"

echo "artefacts mis à jour dans $OUT (lnlab.js reste le shim de chargement committé)"
