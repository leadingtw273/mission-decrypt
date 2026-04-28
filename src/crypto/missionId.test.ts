import { describe, it, expect } from 'vitest';
import { randomMissionId } from './missionId';

describe('randomMissionId', () => {
  it('matches pattern [A-Z]{3}-[A-Z0-9]{5}-[A-Z]{2}[0-9]', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomMissionId()).toMatch(/^[A-Z]{3}-[A-Z0-9]{5}-[A-Z]{2}[0-9]$/);
    }
  });

  it('is unique across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(randomMissionId());
    expect(seen.size).toBe(1000);
  });
});
