import "server-only";

// Edge's read-aloud service only accepts connections carrying a time-based "Sec-MS-GEC" token.
// Since late 2026 it requires the v2 token: a CS64 checksum plus a SHA-256 variant whose first block is
// precomputed. msedge-tts still sends v1 and gets rejected, so this ports the v2 generator from the
// Python edge-tts package (edge_tts/drm.py, v7.3), which is the reference implementation.

export const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
export const CHROMIUM_FULL_VERSION = "143.0.3650.75";
export const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
export const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

const WIN_EPOCH = 11644473600;

const SHA256_INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const SHA256_STATE = [0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6, 0xf0c31573,
  0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564,
];
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7;
// The precomputed first block resumes at round 14, where one round constant is swapped.
const K_FIRST_BLOCK = [...K.slice(0, 14), SHA256_ADJUSTMENT, ...K.slice(15)];
const SIGMA0_ADJUSTMENT = 0x059c0b80;
const SIGMA1_ADJUSTMENT = 0x000b92c0;
const CS64_COEFFICIENTS: [number, number][] = [
  [0xe82e91b1, 0xb32700d0],
  [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038],
  [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5],
  [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6],
  [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da],
  [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3],
  [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1],
  [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

// All arithmetic is on unsigned 32-bit words.
const u32 = (x: number) => x >>> 0;
const add = (...xs: number[]) => xs.reduce((s, x) => (s + x) >>> 0, 0);
const mul = (a: number, b: number) => Math.imul(a, b) >>> 0;
const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
const rol16 = (x: number) => rotr(x, 16);
const sigma0 = (x: number) => u32(rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3));
const sigma1 = (x: number) => u32(rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10));

function sha256Rounds(state: number[], w: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state;
  const k = firstRound === 14 ? K_FIRST_BLOCK : K;
  for (let i = firstRound; i < 64; i++) {
    const t1 = add(h, rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), g ^ (e & (f ^ g)), k[i], w[i]);
    const t2 = add(rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), (a & b) | (c & (a | b)));
    [a, b, c, d, e, f, g, h] = [add(t1, t2), a, b, c, add(d, t1), e, f, g];
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSchedule(w: number[], firstWord = 16) {
  for (let i = firstWord; i < 64; i++) w.push(add(sigma1(w[i - 2]), w[i - 7], sigma0(w[i - 15]), w[i - 16]));
}

function sha256Init(data: Uint8Array): number[] {
  const w = new Array<number>(14).fill(0);
  w.push((data[0] << 16) | (data[1] << 8) | data[2]);
  w.push(u32((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6]));
  for (let i = 16; i < 30; i++) {
    let value = SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) value = add(value, i === 16 ? u32(sigma1(w[i - 2]) ^ SIGMA1_ADJUSTMENT) : sigma1(w[i - 2]));
    if (i - 7 >= 14) value = add(value, w[i - 7]);
    if (i - 15 >= 14) value = add(value, i === 29 ? u32(sigma0(w[i - 15]) ^ SIGMA0_ADJUSTMENT) : sigma0(w[i - 15]));
    w.push(value);
  }
  w.push(u32(add(sigma1(w[28]), w[23], sigma0(w[15]), w[14], SHA256_ADJUSTMENT) - K[14]));
  expandSchedule(w, 31);
  const working = sha256Rounds(SHA256_STATE, w, 14);
  return SHA256_INITIAL.map((x, i) => add(x, working[i]));
}

function sha256Digest(data: Uint8Array): number[] {
  const length = 57 + data.length;
  const zeros = (((55 - length) % 64) + 64) % 64;
  const padded = new Uint8Array(data.length - 7 + 1 + zeros + 8);
  padded.set(data.subarray(7));
  padded[data.length - 7] = 0x80;
  new DataView(padded.buffer).setBigUint64(padded.length - 8, BigInt(length * 8));
  let state = sha256Init(data.subarray(0, 7));
  const view = new DataView(padded.buffer);
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = Array.from({ length: 16 }, (_, i) => view.getUint32(offset + i * 4));
    expandSchedule(w);
    const working = sha256Rounds(state, w);
    state = state.map((x, i) => add(x, working[i]));
  }
  return state;
}

function wordsLe4Even(data: Uint8Array): number[] {
  const padded = new Uint8Array(Math.ceil(data.length / 4) * 4);
  padded.set(data);
  const view = new DataView(padded.buffer);
  const words = Array.from({ length: padded.length / 4 }, (_, i) => view.getUint32(i * 4, true));
  if (words.length % 2) words.push(0);
  return words;
}

function cs64Digest(data: Uint8Array, digest: number[]): [number, number] {
  // The key is the first 8 digest bytes read as two little-endian words.
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setUint32(0, digest[0]);
  bytes.setUint32(4, digest[1]);
  const keyA = u32(bytes.getUint32(0, true) | 1);
  const keyB = u32(bytes.getUint32(4, true) | 1);
  const factors = [mul(keyA, CS64_FACTOR), mul(keyB, CS64_FACTOR)];
  const terms = CS64_COEFFICIENTS.map(([coefficient], i) => mul(coefficient, factors[i % 2]));
  const offsets = CS64_COEFFICIENTS.map(([, offset]) => offset);
  const prefixed = new Uint8Array(data.length + 1);
  prefixed.set(data, 1);
  wordsLe4Even(prefixed).forEach((word, i) => {
    let term = mul(word, i % 2 === 0 ? keyA : keyB);
    let offset = mul(rol16(word), i % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (i === 0) {
      term = add(term, mul(CS64_ADJUSTMENT0, factors[0]));
      offset = add(offset, CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  });

  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i];
    const y = terms[i + 1];
    let q = mul(rol16(add(offsets[i], x)), 0x76f50f34);
    swapAcc = add(swapAcc, mul(rol16(q), 0xc3efea97), q);
    q = mul(rol16(add(offsets[i + 1], y)), 0x1881ce3c);
    swapLast = add(mul(rol16(q), 0x35bd1ec9), q);
    swapAcc = add(swapAcc, swapLast);
    state = add(mul(state, keyA), x);
    state = mul(rol16(state), 0xcf98b111);
    state = mul(rol16(state), 0x87085b9f);
    state = mul(rol16(state), 0x12ceb96d);
    state = mul(rol16(state), 0x257e1d83);
    acc = add(acc, state);
    let t = add(mul(state, keyB), y);
    t = mul(rol16(t), 0xa27416f5);
    t = mul(rol16(t), 0xd38396ff);
    state = mul(rol16(mul(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = add(acc, state);
  }
  return [u32(swapLast ^ state), u32(swapAcc ^ acc)];
}

const hex = (bytes: DataView) =>
  Array.from(new Uint8Array(bytes.buffer), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

// The token changes every 5 minutes: it hashes the current Windows file time rounded down to 300 s.
export function generateSecMsGec(unixSeconds = Date.now() / 1000): string {
  let seconds = Math.floor(unixSeconds) + WIN_EPOCH;
  seconds -= seconds % 300;
  const data = new TextEncoder().encode(`${BigInt(seconds) * BigInt(10_000_000)}${TRUSTED_CLIENT_TOKEN}`);
  const digest = sha256Digest(data);
  const [c0, c1] = cs64Digest(data, digest);
  const cs64 = new DataView(new ArrayBuffer(8));
  cs64.setUint32(0, c0, true);
  cs64.setUint32(4, c1, true);
  const sha = new DataView(new ArrayBuffer(32));
  digest.forEach((x, i) => sha.setUint32(i * 4, x));
  return `${hex(cs64)}-${hex(sha)}`;
}

