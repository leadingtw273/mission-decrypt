import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// @ts-expect-error - react-digital-number ships untyped CommonJS bundle and its package.json points main: 'index.js' to a missing path; the real entry is dist/index.js
import DigitalNumber from 'react-digital-number/dist/index.js';

import type { ClassificationLevel, DifficultyLevel } from '../../crypto/schema';
import { FrameBracket } from './FrameBracket';
import { ProgressBar } from './ProgressBar';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type LockedBriefState = { kind: 'locked'; missionId: string };
type DecryptingBriefState = { kind: 'decrypting'; progress: number; missionId: string };
type DecryptedBriefState = {
  kind: 'decrypted';
  missionId: string;
  classification: ClassificationLevel;
  codename: string;
  difficulty: DifficultyLevel;
  rallyTimeIso: string;
};

export type MissionBriefState =
  | LockedBriefState
  | DecryptingBriefState
  | DecryptedBriefState;

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

const DIFFICULTY_INDEX: Record<DifficultyLevel, number> = {
  low: 1,
  normal: 2,
  hard: 3,
  extreme: 4,
  suicide: 5,
};

const DIFFICULTY_LABEL_EN: Record<DifficultyLevel, string> = {
  low: 'LOW',
  normal: 'NORMAL',
  hard: 'HARD',
  extreme: 'EXTREME',
  suicide: 'SUICIDE',
};

const DIFFICULTY_COLOR: Record<DifficultyLevel, string> = {
  low: 'text-yellow-400/70',
  normal: 'text-yellow-400',
  hard: 'text-orange-400',
  extreme: 'text-orange-500',
  suicide: 'text-red-500',
};

const DIFFICULTY_FILL: Record<DifficultyLevel, string> = {
  low: 'bg-yellow-400/70',
  normal: 'bg-yellow-400',
  hard: 'bg-orange-400',
  extreme: 'bg-orange-500',
  suicide: 'bg-red-500',
};

const LCD_ACTIVE_COLOR = '#FFBA00';
const LCD_INACTIVE_COLOR = 'rgba(255, 186, 0, 0.12)';
const LCD_BACKGROUND_COLOR = 'transparent';
const LCD_DIGIT_WIDTH = 16;
const LCD_DIGIT_HEIGHT = 28;

export function MissionBriefPanel({ state }: { state: MissionBriefState }) {
  return (
    <div className="relative min-h-[340px] overflow-hidden border border-border bg-bg-primary/55 px-4 py-3 md:h-[220px] md:min-h-0 md:px-6 md:py-4">
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === 'decrypting' ? (
          <DecryptingOverlay key="decrypting" progress={state.progress} />
        ) : (
          <RestingPanel
            key="resting"
            classification={state.kind === 'decrypted' ? state.classification : 'unknown'}
            codename={state.kind === 'decrypted' ? state.codename : null}
            difficulty={state.kind === 'decrypted' ? state.difficulty : null}
            missionId={state.missionId}
            rallyTimeIso={state.kind === 'decrypted' ? state.rallyTimeIso : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RestingPanel({
  classification,
  codename,
  difficulty,
  missionId,
  rallyTimeIso,
}: {
  classification: ClassificationLevel | 'unknown';
  codename: string | null;
  difficulty: DifficultyLevel | null;
  missionId: string;
  rallyTimeIso: string | null;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)] md:gap-6 md:px-6 md:py-4"
      exit={{ opacity: 0 }}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    >
      <CodenameBlock codename={codename} missionId={missionId} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:grid-rows-3 md:gap-3">
        <ClassificationRow classification={classification} />
        <CountdownRow rallyTimeIso={rallyTimeIso} className="md:row-start-3" />
        <DifficultyRow difficulty={difficulty} className="col-span-2 md:col-span-1 md:row-start-2" />
      </div>
    </motion.div>
  );
}

function CodenameBlock({
  codename,
  missionId,
}: {
  codename: string | null;
  missionId: string;
}) {
  const { en, zh } = parseCodename(codename);
  const isLocked = codename === null;

  return (
    <FrameBracket
      size={20}
      color="primary"
      className="relative flex items-center justify-center border border-primary/25 bg-primary/[0.06] px-4 py-3 md:px-6"
    >
      <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
        <span className="font-label text-[10px] tracking-[0.32em] text-text/55">CODENAME</span>
        <span
          className={`font-display block w-full break-words text-lg font-bold leading-tight tracking-[0.1em] md:text-xl lg:text-2xl lg:tracking-[0.14em] ${isLocked ? 'text-text/35' : 'text-orange-400'}`}
        >
          {en ?? '— — — —'}
        </span>
        {zh ? (
          <span className="font-body block w-full text-sm text-text/75 tracking-[0.14em] md:text-base">
            {zh}
          </span>
        ) : null}
        <span className="font-label mt-1 text-[9px] tracking-[0.28em] text-text/45">
          UID: {missionId}
        </span>
      </div>
    </FrameBracket>
  );
}

function parseCodename(codename: string | null): { en: string | null; zh: string | null } {
  if (!codename) return { en: null, zh: null };
  const parts = codename.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { en: null, zh: null };
  const [first, ...rest] = parts;
  if (rest.length === 0) return { en: first ?? null, zh: null };
  return { en: first ?? null, zh: rest.join(' / ') };
}

function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <span className="font-label text-[9px] tracking-[0.32em] text-text/55">{label}</span>
      {children}
    </div>
  );
}

function ClassificationRow({
  classification,
  className,
}: {
  classification: ClassificationLevel | 'unknown';
  className?: string;
}) {
  const description = classification === 'unknown' ? null : CLASSIFICATION_DESCRIPTION[classification];

  return (
    <FieldRow label="CLASSIFICATION" {...(className ? { className } : {})}>
      <div className="relative">
        <div
          className={`font-display inline-flex h-6 min-w-[4rem] items-center justify-center border px-2 text-xs font-bold tracking-[0.2em] ${CLASSIFICATION_COLOR[classification]}`}
        >
          {CLASSIFICATION_LABEL[classification]}
        </div>
        {description ? (
          <span className="font-label absolute left-0 top-full mt-1 hidden text-[9px] leading-snug tracking-[0.08em] text-text/55 lg:block">
            {description}
          </span>
        ) : null}
      </div>
    </FieldRow>
  );
}

function DifficultyRow({
  difficulty,
  className,
}: {
  difficulty: DifficultyLevel | null;
  className?: string;
}) {
  const filled = difficulty ? DIFFICULTY_INDEX[difficulty] : 0;
  const colorClass = difficulty ? DIFFICULTY_COLOR[difficulty] : 'text-text/45';
  const fillClass = difficulty ? DIFFICULTY_FILL[difficulty] : 'bg-text/20';

  return (
    <FieldRow label="DIFFICULTY" {...(className ? { className } : {})}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1" aria-label="Difficulty gauge">
          {Array.from({ length: 5 }, (_, index) => {
            const active = index < filled;
            return (
              <span
                key={index}
                data-active={active ? 'true' : 'false'}
                className={`block h-2.5 flex-1 border ${
                  active ? `${fillClass} border-transparent` : 'border-border bg-bg-secondary'
                }`}
              />
            );
          })}
        </div>
        <span
          className={`font-display flex-shrink-0 text-[11px] font-bold tracking-[0.18em] ${colorClass}`}
        >
          {difficulty ? DIFFICULTY_LABEL_EN[difficulty] : '─ ─ ─'}
        </span>
      </div>
    </FieldRow>
  );
}

function CountdownRow({
  rallyTimeIso,
  className,
}: {
  rallyTimeIso: string | null;
  className?: string;
}) {
  const value = useCountdown(rallyTimeIso);
  const display = value ?? '888888';
  const [hh, mm, ss] = splitTriplet(display);

  return (
    <FieldRow label="COUNTDOWN" {...(className ? { className } : {})}>
      <div className="flex items-end gap-1">
        <LcdDigits nums={hh} />
        <LcdSeparator />
        <LcdDigits nums={mm} />
        <LcdSeparator />
        <LcdDigits nums={ss} />
      </div>
    </FieldRow>
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
    <span aria-hidden="true" className="font-display select-none pb-1 text-xl leading-none text-primary">
      :
    </span>
  );
}

function splitTriplet(value: string): [string, string, string] {
  const parts = value.split(':');
  if (parts.length === 3) {
    return [parts[0], parts[1], parts[2]] as [string, string, string];
  }
  if (value.length === 6) {
    return [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)];
  }
  return ['88', '88', '88'];
}

function DecryptingOverlay({ progress }: { progress: number }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 py-4"
      exit={{ opacity: 0 }}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
    >
      <div className="flex w-full items-center gap-3">
        <span className="font-label flex-shrink-0 text-xs tracking-[0.32em] text-primary">
          DECRYPTING
        </span>
        <div className="flex-1">
          <ProgressBar progress={progress} />
        </div>
        <span className="font-display w-16 flex-shrink-0 text-right text-base tabular-nums tracking-[0.05em] text-primary">
          {String(Math.round(progress * 100)).padStart(3, '0')}%
        </span>
        <span aria-hidden="true" className="font-display flex-shrink-0 text-primary">
          ▶
        </span>
      </div>
      <motion.span
        animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0.3, 0.85, 0.3] }}
        aria-hidden="true"
        className="font-label text-[10px] tracking-[0.4em] text-primary/60"
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 1.4, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
        }
      >
        ─ ─ ─ AUTHENTICATING SIGNAL ─ ─ ─
      </motion.span>
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
