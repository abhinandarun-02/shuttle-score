/** Unambiguous alphabet: no I, O, 0 or 1. 32 symbols, 6 characters = 32^6 ≈ 1.07 billion codes. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function generateCode(randomValues: (n: number) => Uint32Array = cryptoRandom): string {
  const values = randomValues(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[values[i] % CODE_ALPHABET.length];
  return out;
}

function cryptoRandom(n: number): Uint32Array {
  return globalThis.crypto.getRandomValues(new Uint32Array(n));
}

/** Accepts user input like " bdm-482 " or a pasted share URL and returns a canonical code. */
export function normalizeCode(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/t\/([A-Za-z0-9]{6})(?:[/?#]|$)/);
  const raw = fromUrl ? fromUrl[1] : trimmed;
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
