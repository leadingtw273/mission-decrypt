import { useEffect, useState } from 'react';

import type { MissionPlaintext } from '../crypto';
import type { FieldName } from '../crypto/schema';
import { FrameBracket } from './shared/FrameBracket';

type DecryptedViewProps = {
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

export function DecryptedView({ mission, heroImage }: DecryptedViewProps) {
  const [heroImageUrl, setHeroImageUrl] = useState('');

  useEffect(() => {
    const imageBuffer = heroImage.bytes.slice().buffer as ArrayBuffer;
    const objectUrl = URL.createObjectURL(new Blob([imageBuffer], { type: heroImage.mimeType }));
    setHeroImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [heroImage.bytes, heroImage.mimeType]);

  return (
    <section className="relative border border-border bg-bg-secondary/60 px-6 py-8 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8">
      <div className="absolute right-6 top-6 text-primary md:right-8 md:top-8">
        <CheckmarkIcon />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex justify-center lg:justify-start">
          <FrameBracket
            size={28}
            color="primary"
            className="w-full max-w-[320px] overflow-hidden border border-primary/30 bg-bg-primary/70 p-3"
          >
            {heroImageUrl ? (
              <img
                alt={heroImage.altText}
                className="aspect-[4/5] w-full object-cover"
                src={heroImageUrl}
              />
            ) : null}
          </FrameBracket>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {FIELD_SPECS.map((field) => (
            <div key={field.name} className="border border-border bg-bg-primary/55 px-4 py-3">
              <p className="font-label text-[11px] text-text/70">{field.label}</p>
              <p className="font-body mt-2 whitespace-pre-wrap text-sm text-primary">
                {mission[field.name]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-9 w-9 drop-shadow-[0_0_12px_rgba(255,186,0,0.22)]"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="23" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
      <path d="M18 33L28 43L46 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
    </svg>
  );
}
