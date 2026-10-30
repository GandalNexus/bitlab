#!/usr/bin/env bash
# BitLab — reconstruit le moteur de minage WASM (rust/miner → public/miner).
#
# L'artefact compilé est commité sous public/miner/ ; ce script n'est utile
# qu'après une modification du crate (rust/miner/src/lib.rs). Même recette que
# le labo Lightning (cible « no-modules » + pont ESM), cf. docs/lightning.md.
#
# Pré-requis :
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-bindgen-cli --version 0.2.100 --locked
set -euo pipefail

cd "$(dirname "$0")/../rust/miner"

cargo build --release --target wasm32-unknown-unknown

rm -rf target/wbindgen-out
wasm-bindgen --target no-modules \
        --out-dir target/wbindgen-out \
        target/wasm32-unknown-unknown/release/miner.wasm

OUT=../../public/miner
cp target/wbindgen-out/miner_bg.wasm      "$OUT/miner_bg.wasm"
cp target/wbindgen-out/miner_bg.wasm.d.ts "$OUT/miner_bg.wasm.d.ts"
cp target/wbindgen-out/miner.d.ts         "$OUT/miner.d.ts"
# Le glue no-modules s'appelle miner.js : renommé miner_bg.js puis rendu
# importable en tant que module ES (export default ajouté en fin de fichier).
cp target/wbindgen-out/miner.js           "$OUT/miner_bg.js"
printf '\nexport default wasm_bindgen;\n' >> "$OUT/miner_bg.js"

cat > "$OUT/miner.js" <<'EOF'
/**
 * BitLab miner — pont navigateur pour le glue wasm-bindgen « no-modules ».
 *
 * Même recette que le labo Lightning (public/lnlab/lnlab.js) : le glue généré
 * par `wasm-bindgen --target no-modules` est rendu importable en tant que
 * module ES (`export default wasm_bindgen` ajouté en fin de fichier glue).
 * Le pont précédent visait les bundlers (`import * as wasm from
 * "./miner_bg.wasm"`) — un .wasm n'est pas un module JavaScript : le worker
 * du mineur ne chargeait plus du tout (ni WASM, ni repli JS).
 *
 * Contrat consommé par `public/miner/worker.js` :
 *   import initWasm, { mine_batch, self_test } from './miner.js';
 *   await initWasm('./miner_bg.wasm');
 */
import wasm_bindgen from './miner_bg.js';

export default wasm_bindgen;
export const mine_batch = wasm_bindgen.mine_batch;
export const self_test = wasm_bindgen.self_test;
export const sha256d_hex = wasm_bindgen.sha256d_hex;
export const target_from_bits_hex = wasm_bindgen.target_from_bits_hex;
EOF

echo "Artefacts régénérés sous public/miner/ — vérification :"
node "$(dirname "$0")/check-miner-wasm.mjs"
