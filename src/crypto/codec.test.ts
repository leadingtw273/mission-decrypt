import { describe, it, expect } from 'vitest';
import { toBase64Url, fromBase64Url, canonicalJSON, utf8Encode, utf8Decode, hmacSha256 } from './codec';

describe('base64url', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('uses url-safe alphabet without padding', () => {
    const bytes = new Uint8Array([0xff, 0xff, 0xff]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('rejects malformed input', () => {
    expect(() => fromBase64Url('!!!')).toThrow();
  });

  it('encodes empty bytes to empty string', () => {
    expect(toBase64Url(new Uint8Array([]))).toBe('');
    expect(fromBase64Url('')).toEqual(new Uint8Array([]));
  });
});

describe('canonicalJSON', () => {
  it('sorts object keys by codepoint', () => {
    expect(canonicalJSON({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('handles nested objects with sorted keys', () => {
    expect(canonicalJSON({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('emits no whitespace', () => {
    expect(canonicalJSON({ a: 1, b: [1, 2, 3] })).toBe('{"a":1,"b":[1,2,3]}');
  });

  it('preserves array order', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });

  it('rejects NaN and Infinity', () => {
    expect(() => canonicalJSON(NaN)).toThrow();
    expect(() => canonicalJSON(Infinity)).toThrow();
  });

  it('emits same output for equivalent inputs', () => {
    const a = canonicalJSON({ x: 1, y: 'foo', z: [1, 2] });
    const b = canonicalJSON({ z: [1, 2], y: 'foo', x: 1 });
    expect(a).toBe(b);
  });
});

describe('utf8 helpers', () => {
  it('round-trips ASCII', () => {
    expect(utf8Decode(utf8Encode('hello'))).toBe('hello');
  });

  it('round-trips emoji + non-Latin', () => {
    expect(utf8Decode(utf8Encode('星際公民 🚀'))).toBe('星際公民 🚀');
  });
});

describe('hmacSha256', () => {
  it('produces 32-byte digest', async () => {
    const out = await hmacSha256(new TextEncoder().encode('key'), new TextEncoder().encode('msg'));
    expect(out).toHaveLength(32);
  });

  it('is deterministic', async () => {
    const a = await hmacSha256(new TextEncoder().encode('k'), new TextEncoder().encode('m'));
    const b = await hmacSha256(new TextEncoder().encode('k'), new TextEncoder().encode('m'));
    expect(a).toEqual(b);
  });

  it('different key produces different digest', async () => {
    const a = await hmacSha256(new TextEncoder().encode('k1'), new TextEncoder().encode('m'));
    const b = await hmacSha256(new TextEncoder().encode('k2'), new TextEncoder().encode('m'));
    expect(a).not.toEqual(b);
  });
});
