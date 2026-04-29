import { type FormEvent, useId, useState } from 'react';

import type { MissionAssetV1 } from '../crypto';
import type { FieldName } from '../crypto/schema';
import { AnimatedCipherText } from './shared/AnimatedCipherText';
import { Button } from './shared/Button';
import { FrameBracket } from './shared/FrameBracket';
import { Input } from './shared/Input';
import { MissionBriefPanel } from './shared/MissionBriefPanel';
import { buildScrambleFrame } from './shared/scramble';

type LockedViewProps = {
  asset: MissionAssetV1;
  onSubmit: (gameId: string, personalKey: string) => void;
  submitting: boolean;
};

const FIELD_SPECS: Array<{ name: FieldName; label: string; length: number }> = [
  { name: 'missionCommander', label: 'MISSION COMMANDER', length: 24 },
  { name: 'communicationChannel', label: 'COMMUNICATION CHANNEL', length: 30 },
  { name: 'missionTime', label: 'MISSION TIME', length: 18 },
  { name: 'rallyTime', label: 'RALLY TIME', length: 18 },
  { name: 'rallyLocation', label: 'RALLY LOCATION', length: 20 },
  { name: 'requiredGear', label: 'REQUIRED GEAR', length: 28 },
  { name: 'accessPermission', label: 'ACCESS PERMISSION', length: 22 },
  { name: 'rewardDistribution', label: 'REWARD DISTRIBUTION', length: 24 },
  { name: 'missionBrief', label: 'MISSION BRIEF', length: 50 },
];


export function LockedView({ asset, onSubmit, submitting }: LockedViewProps) {
  const gameIdInputId = useId();
  const personalKeyInputId = useId();
  const [gameId, setGameId] = useState('');
  const [personalKey, setPersonalKey] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(gameId, personalKey);
  }

  return (
    <section className="border border-border bg-bg-secondary/60 px-6 py-8 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
        <FrameBracket
          size={28}
          color="primary"
          className="border border-primary/30 bg-bg-primary/70 bg-scan-stripes p-6 lg:h-full lg:p-8"
        >
          <div className="flex w-full flex-col gap-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <LockIcon />
              <div className="font-label flex items-center gap-2 text-sm text-primary">
                <span>ACCESS LOCKED</span>
                <span aria-hidden="true" className="inline-block h-4 w-px bg-primary motion-safe:animate-pulse" />
              </div>
              <p className="font-body text-center text-sm text-text/70">
                Mission asset <span className="font-label text-primary">{asset.missionId}</span> requires verified operator credentials.
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="font-label text-xs text-text/70" htmlFor={gameIdInputId}>
                Game ID
              </label>
              <Input
                aria-label="Game ID"
                autoComplete="username"
                disabled={submitting}
                id={gameIdInputId}
                name="gameId"
                placeholder="PILOT-7"
                value={gameId}
                onChange={(event) => setGameId(event.currentTarget.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="font-label text-xs text-text/70" htmlFor={personalKeyInputId}>
                Private Key
              </label>
              <Input
                aria-label="Private Key"
                autoComplete="current-password"
                disabled={submitting}
                id={personalKeyInputId}
                name="personalKey"
                placeholder="XXXX-XXXX-XXXX"
                type="password"
                value={personalKey}
                onChange={(event) => setPersonalKey(event.currentTarget.value)}
              />
            </div>

            <Button
              aria-label="START DECRYPTION"
              className="mt-2 w-full"
              disabled={submitting}
              type="submit"
              variant="primary"
            >
              START DECRYPTION
            </Button>
          </form>
          </div>
        </FrameBracket>

        <div className="flex flex-col gap-4">
          <MissionBriefPanel state={{ kind: 'locked', missionId: asset.missionId }} />
          <div className="grid gap-4">
            {FIELD_SPECS.map((field) => (
              <div key={field.name} className="border border-border bg-bg-primary/55 px-4 py-3">
                <p className="font-label text-[11px] text-text/70">{field.label}</p>
                <p className="font-body mt-2 break-all text-sm text-primary">
                  <AnimatedCipherText
                    mode="typewriter"
                    text={toGibberish(asset.fields[field.name].ciphertext, field.length)}
                  />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function toGibberish(b64url: string, length: number): string {
  // Use the same scramble alphabet/algorithm as AnimatedCipherText so the
  // pre-decrypt placeholder is visually continuous with the initial frame
  // of the decrypting reveal animation.
  const target = b64url.slice(0, length);
  return buildScrambleFrame(b64url, target, 0, b64url);
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-28 w-28 text-primary"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M29 40V28C29 17.5066 37.5066 9 48 9C58.4934 9 67 17.5066 67 28V40" stroke="currentColor" strokeWidth="3" />
      <path d="M22 40H74V82H22V40Z" stroke="currentColor" strokeWidth="3" />
      <path d="M48 55V67" stroke="currentColor" strokeWidth="3" />
      <circle cx="48" cy="53" r="4" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
