import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

const LCD_PLACEHOLDER = '88:88:88';

export function MissionHeaderBar({ state }: { state: MissionHeaderState }) {
  return (
    <div className="relative flex h-20 items-center overflow-hidden border border-border bg-bg-primary/55 px-4">
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

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center gap-4 px-4"
      exit={{ opacity: 0 }}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    >
      <ClassificationBlock classification={classification} />
      <StandbyDecoration />
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
    <div className="flex min-w-0 flex-shrink-0 items-center gap-3">
      <div
        className={`font-display flex h-12 min-w-[5.25rem] items-center justify-center border px-3 text-base tracking-[0.18em] ${CLASSIFICATION_COLOR[classification]}`}
      >
        {CLASSIFICATION_LABEL[classification]}
      </div>
      {description ? (
        <span className="font-label whitespace-nowrap text-[11px] tracking-[0.12em] text-text/55">
          {description}
        </span>
      ) : null}
    </div>
  );
}

function StandbyDecoration() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.span
      animate={prefersReducedMotion ? { opacity: 0.7 } : { opacity: [0.35, 0.85, 0.35] }}
      aria-hidden="true"
      className="font-label flex-1 text-center text-[11px] tracking-[0.4em] text-primary/70"
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
  return (
    <div className="relative font-display flex-shrink-0 select-none text-2xl tracking-[0.15em]">
      <span aria-hidden="true" className="text-primary/15">
        {LCD_PLACEHOLDER}
      </span>
      <span className="absolute inset-0 text-primary">{value ?? LCD_PLACEHOLDER}</span>
    </div>
  );
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
