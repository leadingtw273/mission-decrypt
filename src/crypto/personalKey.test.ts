import { describe, it, expect } from 'vitest';
import { generatePersonalKey, validatePersonalKey, formatPersonalKey, parsePersonalKey } from './personalKey';

describe('personalKey', () => {
  it('generates 16-char key (excluding hyphens) with valid checksum', () => {
    const key = generatePersonalKey();
    expect(key.replace(/-/g, '')).toHaveLength(16);
    expect(validatePersonalKey(key)).toBe(true);
  });

  it('formats with hyphens every 4 chars', () => {
    const formatted = formatPersonalKey('ABCDEFGHJKMNPQR0');
    expect(formatted).toBe('ABCD-EFGH-JKMN-PQR0');
  });

  it('parses removes hyphens and uppercases', () => {
    expect(parsePersonalKey('abcd-efgh-jkmn-pqr0')).toBe('ABCDEFGHJKMNPQR0');
    expect(parsePersonalKey('ABCDEFGHJKMNPQR0')).toBe('ABCDEFGHJKMNPQR0');
  });

  it('rejects keys with bad checksum', () => {
    const valid = generatePersonalKey();
    const tampered = valid.slice(0, -1) + (valid.slice(-1) === '0' ? '1' : '0');
    expect(validatePersonalKey(tampered)).toBe(false);
  });

  it('rejects keys with illegal chars (I, L, O, U)', () => {
    expect(validatePersonalKey('IIII-IIII-IIII-IIII')).toBe(false);
    expect(validatePersonalKey('LLLL-LLLL-LLLL-LLLL')).toBe(false);
    expect(validatePersonalKey('OOOO-OOOO-OOOO-OOOO')).toBe(false);
    expect(validatePersonalKey('UUUU-UUUU-UUUU-UUUU')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validatePersonalKey('ABCD-EFGH')).toBe(false);
    expect(validatePersonalKey('ABCD-EFGH-JKMN-PQR0X')).toBe(false);
  });

  it('two consecutive generations differ (entropy)', () => {
    const a = generatePersonalKey();
    const b = generatePersonalKey();
    expect(a).not.toBe(b);
  });

  it('detects single-char typo via checksum (>50% catch rate)', () => {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let caught = 0;
    let total = 0;
    for (let trial = 0; trial < 50; trial++) {
      const key = parsePersonalKey(generatePersonalKey());
      // flip a random char (excluding checksum at index 15)
      const idx = Math.floor(Math.random() * 15);
      const orig = key[idx]!;
      const replacement = alphabet[(alphabet.indexOf(orig) + 1) % alphabet.length]!;
      const corrupted = key.slice(0, idx) + replacement + key.slice(idx + 1);
      total++;
      if (!validatePersonalKey(formatPersonalKey(corrupted))) caught++;
    }
    expect(caught / total).toBeGreaterThan(0.5);
  });
});
