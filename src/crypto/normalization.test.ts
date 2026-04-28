import { describe, it, expect } from 'vitest';
import { normalizeGameId } from './normalization';

describe('normalizeGameId', () => {
  it('lowercases', () => {
    expect(normalizeGameId('LeadingTW')).toBe('leadingtw');
  });

  it('trims whitespace', () => {
    expect(normalizeGameId('  leadi  ')).toBe('leadi');
  });

  it('applies NFKC (full-width to half-width)', () => {
    expect(normalizeGameId('ｌｅａｄｉ')).toBe('leadi');
  });

  it('allows alphanumeric, underscore, hyphen', () => {
    expect(normalizeGameId('Ace_Pilot-42')).toBe('ace_pilot-42');
  });

  it('rejects empty after trim', () => {
    expect(() => normalizeGameId('   ')).toThrow();
    expect(() => normalizeGameId('')).toThrow();
  });

  it('rejects too long (>32)', () => {
    expect(() => normalizeGameId('a'.repeat(33))).toThrow();
  });

  it('rejects illegal chars (space, dot, slash, emoji)', () => {
    expect(() => normalizeGameId('ace pilot')).toThrow();
    expect(() => normalizeGameId('ace.pilot')).toThrow();
    expect(() => normalizeGameId('ace/pilot')).toThrow();
    expect(() => normalizeGameId('🚀pilot')).toThrow();
  });

  it('is idempotent', () => {
    const once = normalizeGameId('  LeadingTW  ');
    expect(normalizeGameId(once)).toBe(once);
  });
});
