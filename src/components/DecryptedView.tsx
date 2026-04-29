import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import type { MissionAssetV1, MissionPlaintext } from '../crypto';
import type { ClassificationLevel, DifficultyLevel, FieldName } from '../crypto/schema';
import { AnimatedCipherText } from './shared/AnimatedCipherText';
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
const FIELD_STAGGER_MS = REVEAL_DURATION_MS / FIELD_SPECS.length;

export function DecryptedView({ asset, mission, heroImage }: DecryptedViewProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [progress, setProgress] = useState(prefersReducedMotion ? 1 : 0);

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

    const start = performance.now();
    let raf = 0;
    function tick() {
      const elapsed = performance.now() - start;
      const next = Math.min(1, elapsed / REVEAL_DURATION_MS);
      setProgress(next);
      if (next < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    }
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [prefersReducedMotion]);

  const showImage = progress >= 1;

  return (
    <section className="relative overflow-hidden border border-border bg-bg-secondary/60 px-6 py-8 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8">
      {!showImage ? <ScannerSweep /> : null}

      <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-stretch">
        <div className="flex justify-center lg:block lg:h-full">
          <FrameBracket
            size={28}
            color="primary"
            className="w-full max-w-[320px] overflow-hidden border border-primary/30 bg-bg-primary/70 bg-scan-stripes p-3 lg:h-full lg:max-w-none lg:p-0"
          >
            {showImage && heroImageUrl ? (
              <motion.img
                alt={heroImage.altText}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
                className="aspect-[4/5] w-full object-contain lg:aspect-auto lg:h-full"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                src={heroImageUrl}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
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

          <div className="grid gap-3 lg:grid-cols-2">
            {FIELD_SPECS.map((field, index) => {
              const rawValue = mission[field.name];
              const displayValue = field.name === 'rallyTime' ? formatRallyTime(rawValue) : rawValue;
              const isBrief = field.name === 'missionBrief';
              const isFullWidth = isBrief || field.name === 'rewardDistribution';
              const cardClassName = isBrief
                ? 'flex h-[10.5rem] flex-col border border-border bg-bg-primary/55 px-4 py-2.5 lg:col-span-2'
                : `flex h-16 flex-col justify-center border border-border bg-bg-primary/55 px-4 ${isFullWidth ? 'lg:col-span-2' : ''}`;
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
                      startDelayMs={index * FIELD_STAGGER_MS}
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
      className="flex h-full min-h-[16rem] w-full flex-col items-center justify-center gap-4 bg-bg-primary/30 lg:min-h-0"
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

