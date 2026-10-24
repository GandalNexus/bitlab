
export function hexToBytes(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length % 2 !== 0) {
    throw new Error('hexToBytes: chaîne invalide');
  }
  const out = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function reverseBytes(bytes) {
  return bytes.slice().reverse();
}
