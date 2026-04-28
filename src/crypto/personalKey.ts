// Crockford base32 alphabet (excludes I, L, O, U)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALPHABET_INDEX = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_INDEX.set(ALPHABET[i]!, i);

const BODY_LEN = 15;  // payload chars (75 bits entropy)
const TOTAL_LEN = 16; // 15 payload + 1 checksum

export function generatePersonalKey(): string {
  const bytes = new Uint8Array(BODY_LEN);
  crypto.getRandomValues(bytes);
  let body = '';
  for (let i = 0; i < BODY_LEN; i++) {
    body += ALPHABET[bytes[i]! % 32]!;
  }
  return formatPersonalKey(body + checksum(body));
}

export function formatPersonalKey(raw: string): string {
  // raw: 16 chars no hyphens
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function parsePersonalKey(input: string): string {
  return input.replace(/-/g, '').toUpperCase();
}

export function validatePersonalKey(input: string): boolean {
  const parsed = parsePersonalKey(input);
  if (parsed.length !== TOTAL_LEN) return false;
  for (const ch of parsed) {
    if (!ALPHABET_INDEX.has(ch)) return false;
  }
  const body = parsed.slice(0, BODY_LEN);
  const expected = checksum(body);
  return parsed[BODY_LEN] === expected;
}

function checksum(body: string): string {
  // Sum of alphabet indices mod 32 — simple, catches most single-char typos
  let sum = 0;
  for (const ch of body) sum += ALPHABET_INDEX.get(ch)!;
  return ALPHABET[sum % 32]!;
}
