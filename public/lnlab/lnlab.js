/**
 * BitLab lnlab — browser bridge for the wasm-bindgen "no-modules" glue.
 */
import wasm_bindgen from "./lnlab_bg.js";

export default async function initWasm(opts) {
  const url = new URL("lnlab_bg.wasm", import.meta.url);
  url.searchParams.set("v", "a0e59734d98c");
  return wasm_bindgen({ ...opts, module_or_path: url });
}
export const LnLab = wasm_bindgen.LnLab;
