/**
 * BitLab lnlab — pont navigateur pour le glue wasm-bindgen « no-modules ».
 *
 * Le glue (`lnlab_bg.js`) est généré par `wasm-bindgen --target no-modules`
 * puis rendu importable en tant que module ES (`export default wasm_bindgen`
 * ajouté en fin de fichier). Un import direct de `./lnlab_bg.wasm` ne peut pas
 * fonctionner dans un module worker natif — le navigateur refuse un .wasm
 * comme module JavaScript (c'était la panne « worker: undefined »).
 *
 * Contrat consommé par `worker.js` :
 *   import initWasm, { LnLab } from './lnlab.js';
 *   await initWasm({ module_or_path: new URL('lnlab_bg.wasm', import.meta.url) });
 */
import wasm_bindgen from './lnlab_bg.js';

export default wasm_bindgen;
export const LnLab = wasm_bindgen.LnLab;
