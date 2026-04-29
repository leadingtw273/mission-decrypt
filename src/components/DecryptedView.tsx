import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import type { MissionAssetV1, MissionPlaintext } from '../crypto';
import type { ClassificationLevel, DifficultyLevel, FieldName } from '../crypto/schema';
import { AnimatedCipherText } from './shared/AnimatedCipherText';
import { Button } from './shared/Button';
import { FrameBracket } from './shared/FrameBracket';
import { MissionBriefPanel } from './shared/MissionBriefPanel';
import { ScannerSweep } from './shared/ScannerSweep';
import { usePrefersReducedMotion } from './shared/usePrefersReducedMotion';

type DecryptedViewProps = {
  asset: MissionAssetV1;
  mission: MissionPlaintext;
  heroImage: {
    mimeType: string;
    bytes: Uint8Array;
    altText: string;
  };
};

const FIELD_SPECS: Array<{ name: FieldName; label: string }> = [
  { name: 'missionCommander', label: 'MISSION COMMANDER' },
  { name: 'communicationChannel', label: 'COMMUNICATION CHANNEL' },
  { name: 'missionTime', label: 'MISSION TIME' },
  { name: 'rallyTime', label: 'RALLY TIME' },
  { name: 'rallyLocation', label: 'RALLY LOCATION' },
  { name: 'requiredGear', label: 'REQUIRED GEAR' },
  { name: 'accessPermission', label: 'ACCESS PERMISSION' },
  { name: 'rewardDistribution', label: 'REWARD DISTRIBUTION' },
  { name: 'missionBrief', label: 'MISSION BRIEF' },
];

const REVEAL_DURATION_MS = 8000;
const FIELD_REVEAL_FRACTION = 500 / REVEAL_DURATION_MS;
const REQUIRED_GEAR_INDEX = FIELD_SPECS.findIndex((field) => field.name === 'requiredGear');
const PAUSE_AT_FRACTION = REQUIRED_GEAR_INDEX / FIELD_SPECS.length;

function fieldRevealProgress(overallProgress: number, fieldIndex: number): number {
  const fieldStart = fieldIndex / FIELD_SPECS.length;
  const span = FIELD_REVEAL_FRACTION;
  return Math.max(0, Math.min(1, (overallProgress - fieldStart) / span));
}

export function DecryptedView({ asset, mission, heroImage }: DecryptedViewProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [progress, setProgress] = useState(prefersReducedMotion ? 1 : 0);
  const [paused, setPaused] = useState(false);
  const acknowledgedRef = useRef(false);
  const elapsedRef = useRef(0);
  const isExtreme = mission.classification === 'extreme';

  useEffect(() => {
    const imageBuffer = heroImage.bytes.slice().buffer as ArrayBuffer;
    const objectUrl = URL.createObjectURL(new Blob([imageBuffer], { type: heroImage.mimeType }));
    setHeroImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [heroImage.bytes, heroImage.mimeType]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setProgress(1);
      return;
    }
    if (paused) return;

    let lastTime = performance.now();
    let raf = 0;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const now = performance.now();
      elapsedRef.current += now - lastTime;
      lastTime = now;

      const next = Math.min(1, elapsedRef.current / REVEAL_DURATION_MS);

      if (isExtreme && !acknowledgedRef.current && next >= PAUSE_AT_FRACTION) {
        elapsedRef.current = REVEAL_DURATION_MS * PAUSE_AT_FRACTION;
        setProgress(PAUSE_AT_FRACTION);
        setPaused(true);
        return;
      }

      setProgress(next);
      if (next < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    }

    raf = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [paused, prefersReducedMotion, isExtreme]);

  const handleContinueExtreme = () => {
    acknowledgedRef.current = true;
    setPaused(false);
  };

  const handleCancelReview = () => {
    window.location.reload();
  };

  const showImage = progress >= 1;

  return (
    <section className="relative overflow-hidden border border-border bg-bg-secondary/60 px-6 py-8 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8">
      {!showImage ? <ScannerSweep /> : null}

      <div className="relative z-10 grid gap-8 xl:grid-cols-2 xl:items-stretch">
        <div className="w-full xl:h-full">
          <FrameBracket
            size={28}
            color="primary"
            className="w-full overflow-hidden border border-primary/30 bg-bg-primary/70 bg-scan-stripes p-3 xl:h-full xl:p-0"
          >
            {showImage && heroImageUrl ? (
              <motion.img
                alt={heroImage.altText}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
                className="aspect-video w-full object-contain md:aspect-[4/5] xl:aspect-auto xl:h-full"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                src={heroImageUrl}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
              />
            ) : paused ? (
              <ExtremeWarningPanel
                onContinue={handleContinueExtreme}
                onCancel={handleCancelReview}
              />
            ) : (
              <DecryptingScan />
            )}
          </FrameBracket>
        </div>

        <div className="flex flex-col gap-4">
          <MissionBriefPanel
            state={
              showImage
                ? {
                    kind: 'decrypted',
                    missionId: asset.missionId,
                    classification: mission.classification as ClassificationLevel,
                    codename: mission.codename,
                    difficulty: mission.difficulty as DifficultyLevel,
                    rallyTimeIso: mission.rallyTime,
                  }
                : { kind: 'decrypting', progress, missionId: asset.missionId }
            }
          />

          <div className="grid gap-3 xl:grid-cols-2">
            {FIELD_SPECS.map((field, index) => {
              const rawValue = mission[field.name];
              const displayValue = field.name === 'rallyTime' ? formatRallyTime(rawValue) : rawValue;
              const isBrief = field.name === 'missionBrief';
              const isFullWidth = isBrief || field.name === 'accessPermission' || field.name === 'rewardDistribution';
              const cardClassName = isBrief
                ? 'flex h-[10.5rem] flex-col border border-border bg-bg-primary/55 px-4 py-2.5 xl:col-span-2'
                : `flex h-16 flex-col justify-center border border-border bg-bg-primary/55 px-4 ${isFullWidth ? 'xl:col-span-2' : ''}`;
              const bodyClassName = isBrief
                ? 'font-body mt-2 flex-1 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-6 text-primary'
                : 'font-body mt-1 truncate whitespace-nowrap text-sm text-primary';

              return (
                <div key={field.name} className={cardClassName}>
                  <p className="font-label text-[11px] text-text/70">{field.label}</p>
                  <p className={bodyClassName}>
                    <AnimatedCipherText
                      mode="scramble-reveal"
                      sourceText={asset.fields[field.name].ciphertext}
                      progress={fieldRevealProgress(progress, index)}
                      text={displayValue}
                    />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExtremeWarningPanel({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full min-h-[22rem] w-full flex-col items-center justify-center gap-5 px-6 py-8 text-center xl:min-h-0">
      <WarningTriangleIcon />
      <span className="font-display text-lg font-bold tracking-[0.28em] text-red-500 md:text-xl">
        EXTREME CLASSIFICATION
      </span>
      <p className="font-body max-w-md text-base leading-relaxed text-text/90">
        正在解密「
        <span className="font-display font-bold text-red-500">EXTREME (極)</span>
        」機密任務內容
      </p>
      <ul className="font-body max-w-md space-y-2 text-left text-sm leading-relaxed text-text/80">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-primary">›</span>
          <span>嚴禁向任何第三方透露此任務內容。</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-primary">›</span>
          <span>確認當前面板左右無其他人員後再繼續。</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-primary">›</span>
          <span>違者按照團隊紀律處置。</span>
        </li>
      </ul>
      <div className="mt-2 flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <Button
          aria-label="繼續解密"
          className="flex-1"
          type="button"
          variant="primary"
          onClick={onContinue}
        >
          繼續解密
        </Button>
        <Button
          aria-label="取消檢閱"
          className="flex-1"
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          取消檢閱
        </Button>
      </div>
    </div>
  );
}

function WarningTriangleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-20 w-20 text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.45)] md:h-24 md:w-24"
      fill="none"
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M48 8 L90 84 H6 Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        fill="rgba(239, 68, 68, 0.12)"
      />
      <path
        d="M48 38 V62"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="48" cy="74" r="4" fill="currentColor" />
    </svg>
  );
}

function formatRallyTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetH = Math.floor(absOffset / 60);
  const offsetM = absOffset % 60;
  const offsetStr = offsetM > 0
    ? `GMT${sign}${offsetH}:${String(offsetM).padStart(2, '0')}`
    : `GMT${sign}${offsetH}`;

  return `${yyyy}-${mm}-${dd} ${hh}:${min} (${offsetStr})`;
}

function DecryptingScan() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="flex h-full min-h-[16rem] w-full flex-col items-center justify-center gap-4 bg-bg-primary/30 xl:min-h-0"
    >
      <motion.div
        animate={prefersReducedMotion ? { rotate: 0, scale: 1 } : { rotate: 360 }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/30"
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 1.6, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
        }
      >
        <div className="absolute inset-2 rounded-full border border-dashed border-primary/40" />
        <div className="absolute inset-0 rounded-full border-t-2 border-primary border-r-2 border-r-primary/15 border-b-2 border-b-primary/5 border-l-2 border-l-primary/40" />
        <span className="font-display text-primary">{'>>'}</span>
      </motion.div>
      <span className="font-label text-xs text-primary">[ DECRYPTING_ ]</span>
    </div>
  );
}

