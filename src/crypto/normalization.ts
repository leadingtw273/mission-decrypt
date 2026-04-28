const ALLOWED = /^[a-z0-9_-]+$/;

export function normalizeGameId(raw: string): string {
  const trimmed = raw.trim();
  const nfkc = trimmed.normalize('NFKC');
  const lower = nfkc.toLowerCase();
  if (lower.length === 0) {
    throw new Error('game_id is empty after normalization');
  }
  if (lower.length > 32) {
    throw new Error('game_id exceeds 32 characters');
  }
  if (!ALLOWED.test(lower)) {
    throw new Error('game_id contains illegal characters');
  }
  return lower;
}
