import { useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const SCRAMBLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-/%$@!#^&*';
const TYPEWRITER_INTERVAL_MS = 50;
const SCRAMBLE_TOTAL_MS = 500;
const SCRAMBLE_TICK_MS = 50;

type AnimatedCipherTextProps = {
  text: string;
  className?: string;
  mode: 'typewriter' | 'scramble-reveal';
  sourceText?: string;
  startDelayMs?: number;
};

export function AnimatedCipherText({
  text,
  className,
  mode,
  sourceText,
  startDelayMs = 0,
}: AnimatedCipherTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedSourceText = sourceText ?? text;

  const scrambleSeed = useMemo(
    () => `${resolvedSourceText}:${text}`,
    [resolvedSourceText, text],
  );

  const [frame, setFrame] = useState(() => {
    if (prefersReducedMotion) return text;
    if (mode === 'scramble-reveal') {
      return buildScrambleFrame(resolvedSourceText, text, 0, scrambleSeed);
    }
    return text;
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      setFrame(text);
      return;
    }

    let intervalId: number | null = null;

    const startTimerId = window.setTimeout(() => {
      if (mode === 'typewriter') {
        setFrame('');

        let visibleCharacters = 0;
        intervalId = window.setInterval(() => {
          visibleCharacters += 1;
          if (visibleCharacters >= text.length) {
            setFrame(text);
            if (intervalId !== null) window.clearInterval(intervalId);
            return;
          }
          setFrame(text.slice(0, visibleCharacters));
        }, TYPEWRITER_INTERVAL_MS);

        return;
      }

      let elapsed = 0;
      setFrame(buildScrambleFrame(resolvedSourceText, text, 0, scrambleSeed));

      intervalId = window.setInterval(() => {
        elapsed += SCRAMBLE_TICK_MS;
        if (elapsed >= SCRAMBLE_TOTAL_MS) {
          setFrame(text);
          if (intervalId !== null) window.clearInterval(intervalId);
          return;
        }

        setFrame(
          buildScrambleFrame(
            resolvedSourceText,
            text,
            elapsed / SCRAMBLE_TOTAL_MS,
            scrambleSeed,
          ),
        );
      }, SCRAMBLE_TICK_MS);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimerId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [mode, prefersReducedMotion, resolvedSourceText, scrambleSeed, startDelayMs, text]);

  return (
    <span className={className} data-motion-mode={prefersReducedMotion ? 'reduced' : mode}>
      {frame}
    </span>
  );
}

function buildScrambleFrame(sourceText: string, targetText: string, progress: number, seed: string) {
  const resolvedCharacters = Math.floor(targetText.length * progress);

  return targetText
    .split('')
    .map((character, index) => {
      if (index < resolvedCharacters) {
        return character;
      }

      const fallback = sourceText[index % Math.max(sourceText.length, 1)] ?? sourceText.at(-1) ?? SCRAMBLE_ALPHABET[0];
      if (character === ' ') {
        return ' ';
      }

      const poolIndex = Math.abs(hashCode(`${seed}:${progress}:${index}:${fallback}`)) % SCRAMBLE_ALPHABET.length;
      return SCRAMBLE_ALPHABET[poolIndex] ?? fallback;
    })
    .join('');
}

function hashCode(input: string) {
  let hash = 0;

  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return hash;
}
