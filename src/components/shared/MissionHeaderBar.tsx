import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// @ts-expect-error - react-digital-number ships untyped CommonJS bundle and its package.json points main: 'index.js' to a missing path; the real entry is dist/index.js
import DigitalNumber from 'react-digital-number/dist/index.js';

import type { ClassificationLevel } from '../../crypto/schema';
import { ProgressBar } from './ProgressBar';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type LockedHeaderState = { kind: 'locked' };
type DecryptingHeaderState = { kind: 'decrypting'; progress: number };
type DecryptedHeaderState = {
  kind: 'decrypted';
  classification: ClassificationLevel;
  rallyTimeIso: string;
};

export type MissionHeaderState =
  | LockedHeaderState
  | DecryptingHeaderState
  | DecryptedHeaderState;

const CLASSIFICATION_LABEL: Record<ClassificationLevel | 'unknown', string> = {
  extreme: 'EXTREME',
  high: 'HIGH',
  low: 'LOW',
  unknown: 'UNKNOWN',
};

const CLASSIFICATION_DESCRIPTION: Record<ClassificationLevel, string> = {
  extreme: '不可向任何第三者透露',
  high: '不可向本團成員以外人員透露',
  low: '不可未經授權對外公開內容',
};

const CLASSIFICATION_COLOR: Record<ClassificationLevel | 'unknown', string> = {
  extreme: 'text-red-500 border-red-500/60',
  high: 'text-orange-400 border-orange-400/60',
  low: 'text-yellow-400 border-yellow-400/60',
  unknown: 'text-text/45 border-text/30',
};

const LCD_ACTIVE_COLOR = '#FFBA00';
const LCD_INACTIVE_COLOR = 'rgba(255, 186, 0, 0.12)';
const LCD_BACKGROUND_COLOR = 'transparent';
const LCD_DIGIT_WIDTH = 18;
const LCD_DIGIT_HEIGHT = 32;

export function MissionHeaderBar({ state }: { state: MissionHeaderState }) {
  return (
    <div className="relative flex h-24 items-center overflow-hidden border border-border bg-bg-primary/55 px-4">
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === 'decrypting' ? (
          <DecryptingBar key="decrypting" progress={state.progress} />
        ) : (
          <RestingBar
            key="resting"
            classification={state.kind === 'decrypted' ? state.classification : 'unknown'}
            rallyTimeIso={state.kind === 'decrypted' ? state.rallyTimeIso : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RestingBar({
  classification,
  rallyTimeIso,
}: {
  classification: ClassificationLevel | 'unknown';
  rallyTimeIso: string | null;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isUnknown = classification === 'unknown';

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center gap-4 px-4"
      exit={{ opacity: 0 }}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    >
      <ClassificationBlock classification={classification} />
      <div className="flex flex-1 justify-center" aria-hidden="true">
        {isUnknown ? <StandbyDecoration /> : null}
      </div>
      <CountdownLcd rallyTimeIso={rallyTimeIso} />
    </motion.div>
  );
}

function ClassificationBlock({
  classification,
}: {
  classification: ClassificationLevel | 'unknown';
}) {
  const description = classification === 'unknown' ? null : CLASSIFICATION_DESCRIPTION[classification];

  return (
    <div className="flex min-w-0 flex-shrink-0 flex-col gap-1">
      <span className="font-label text-[10px] tracking-[0.32em] text-text/55">CLASSIFICATION</span>
      <div className="flex items-center gap-3">
        <div
          className={`font-display flex h-9 min-w-[4.5rem] items-center justify-center border px-3 text-sm font-bold tracking-[0.18em] md:min-w-[5.5rem] md:text-base md:tracking-[0.22em] ${CLASSIFICATION_COLOR[classification]}`}
        >
          {CLASSIFICATION_LABEL[classification]}
        </div>
        {description ? (
          <span className="font-label hidden whitespace-nowrap text-[11px] tracking-[0.12em] text-text/55 md:inline">
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StandbyDecoration() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.span
      animate={prefersReducedMotion ? { opacity: 0.7 } : { opacity: [0.35, 0.85, 0.35] }}
      aria-hidden="true"
      className="font-label hidden text-[11px] tracking-[0.4em] text-primary/70 md:inline-block"
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 1.6, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
      }
    >
      [ STANDBY ]
    </motion.span>
  );
}

function CountdownLcd({ rallyTimeIso }: { rallyTimeIso: string | null }) {
  const value = useCountdown(rallyTimeIso);
  const display = value ?? '888888';
  const [hh, mm, ss] = splitTriplet(display);

  return (
    <div className="flex flex-shrink-0 items-end gap-1">
      <LcdDigits nums={hh} />
      <LcdSeparator />
      <LcdDigits nums={mm} />
      <LcdSeparator />
      <LcdDigits nums={ss} />
    </div>
  );
}

function LcdDigits({ nums }: { nums: string }) {
  const width = `${nums.length * LCD_DIGIT_WIDTH}px`;
  return (
    <div style={{ width, height: `${LCD_DIGIT_HEIGHT}px` }}>
      <DigitalNumber
        nums={nums}
        color={LCD_ACTIVE_COLOR}
        unActiveColor={LCD_INACTIVE_COLOR}
        backgroundColor={LCD_BACKGROUND_COLOR}
      />
    </div>
  );
}

function LcdSeparator() {
  return (
    <span
      aria-hidden="true"
      className="font-display select-none pb-1 text-2xl leading-none text-primary"
    >
      :
    </span>
  );
}

function splitTriplet(value: string): [string, string, string] {
  const parts = value.split(':');
  if (parts.length === 3) {
    return [parts[0], parts[1], parts[2]] as [string, string, string];
  }
  // Placeholder "888888" → 88:88:88
  if (value.length === 6) {
    return [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)];
  }
  return ['88', '88', '88'];
}

function DecryptingBar({ progress }: { progress: number }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center gap-3 px-4"
      exit={{ opacity: 0 }}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    >
      <span className="font-label flex-shrink-0 text-xs tracking-[0.22em] text-primary">
        DECRYPTING
      </span>
      <div className="flex-1">
        <ProgressBar progress={progress} />
      </div>
      <span className="font-display flex-shrink-0 text-base tracking-[0.1em] text-primary">
        {String(Math.round(progress * 100)).padStart(3, '0')}%
      </span>
      <span aria-hidden="true" className="font-display flex-shrink-0 text-primary">
        ▶
      </span>
    </motion.div>
  );
}

function useCountdown(rallyTimeIso: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!rallyTimeIso) return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [rallyTimeIso]);

  if (!rallyTimeIso) return null;
  const target = Date.parse(rallyTimeIso);
  if (!Number.isFinite(target)) return null;

  const remainingMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
