export const SCRAMBLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-/%$@!#^&*';

export function buildScrambleFrame(
  sourceText: string,
  targetText: string,
  progress: number,
  seed: string,
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

      const poolIndex =
        Math.abs(hashCode(`${seed}:${progress}:${index}:${fallback}`)) % SCRAMBLE_ALPHABET.length;
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
