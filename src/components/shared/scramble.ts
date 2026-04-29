export const SCRAMBLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-/%$@!#^&*';

export function buildScrambleFrame(
  sourceText: string,
  targetText: string,
  progress: number,
  _seed: string,
): string {
  const resolvedCharacters = Math.floor(targetText.length * progress);

  return targetText
    .split('')
    .map((character, index) => {
      if (index < resolvedCharacters) {
        return character;
      }

      const fallback =
        sourceText[index % Math.max(sourceText.length, 1)] ??
        sourceText.at(-1) ??
        SCRAMBLE_ALPHABET[0]!;
      if (character === ' ') {
        return ' ';
      }

      // Seed depends ONLY on sourceText + index (and optional jitter from
      // the in-flight progress). The plaintext target deliberately does not
      // contribute, so a position's scramble character is identical between
      // LockedView (no plaintext) and DecryptedView at progress=0.
      const jitter = progress > 0 && progress < 1 ? `:${progress.toFixed(3)}` : '';
      const poolIndex =
        Math.abs(hashCode(`${sourceText}:${index}:${fallback}${jitter}`)) % SCRAMBLE_ALPHABET.length;
      return SCRAMBLE_ALPHABET[poolIndex] ?? fallback;
    })
    .join('');
}

export function hashCode(input: string): number {
  let hash = 0;
  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return hash;
}
