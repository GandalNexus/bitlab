/**
 * BitLab miner — pont navigateur pour le glue wasm-bindgen « no-modules ».
 *
 * Même recette que le labo Lightning (public/lnlab/lnlab.js) : le glue généré
 * par `wasm-bindgen --target no-modules` est rendu importable en tant que
 * module ES (`export default wasm_bindgen` ajouté en fin de lnlab_bg.js
 * équivalent). Le pont précédent visait les bundlers (`import * as wasm from
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
