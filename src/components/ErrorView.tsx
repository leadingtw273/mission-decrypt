import { motion } from 'framer-motion';

import type { DecryptErrorReason } from '../crypto';
import { Button } from './shared/Button';
import { FrameBracket } from './shared/FrameBracket';
import { usePrefersReducedMotion } from './shared/usePrefersReducedMotion';

type ErrorViewProps = {
  reason: DecryptErrorReason;
  retryable: boolean;
  onRetry?: () => void;
};

const ERROR_MESSAGES: Record<DecryptErrorReason, string> = {
  missing_mission_id: 'NO MISSION SPECIFIED',
  not_found: 'MISSION NOT FOUND',
  invalid_asset: 'TRANSMISSION CORRUPTED',
  unsupported_env: 'BROWSER UNSUPPORTED — REQUIRES HTTPS + MODERN BROWSER',
  unsupported_version: 'PROTOCOL VERSION MISMATCH',
  forged_asset: '⚠️ MISSION SIGNATURE INVALID — DO NOT TRUST',
  auth_failed: 'DECRYPTION FAILED',
  cipher_corrupt: 'DECRYPTION FAILED — TRANSMISSION DAMAGED',
  invalid_personal_key_format: 'INVALID KEY FORMAT',
};

export function ErrorView({ reason, retryable, onRetry }: ErrorViewProps) {
  const isForgedAsset = reason === 'forged_asset';
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.section
      animate={
        prefersReducedMotion
          ? { x: 0, boxShadow: '0 0 40px rgba(229,72,77,0.12)' }
          : {
              x: [0, -12, 12, -8, 8, 0],
              boxShadow: [
                '0 0 40px rgba(229,72,77,0.12)',
                '0 0 52px rgba(229,72,77,0.3)',
                '0 0 40px rgba(229,72,77,0.12)',
              ],
            }
      }
      aria-live="assertive"
      className="relative overflow-hidden border border-border bg-bg-secondary/60 px-6 py-8 shadow-[0_0_40px_rgba(229,72,77,0.12)] md:px-8"
      initial={prefersReducedMotion ? false : { x: 0, boxShadow: '0 0 40px rgba(229,72,77,0.12)' }}
      role="alert"
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
    >
      <motion.div
        animate={prefersReducedMotion ? { opacity: 0 } : { opacity: [0, 0.22, 0] }}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-danger/18"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
      />
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-6 text-center">
        <FrameBracket
          size={26}
          color="var(--color-danger)"
          className="border border-[var(--color-danger)] bg-bg-primary/70 px-8 py-8"
        >
          <DangerIcon pulse={isForgedAsset} />
        </FrameBracket>

        <div className="flex max-w-2xl flex-col items-center gap-3">
          <p className={joinClasses('font-display text-lg md:text-xl', isForgedAsset ? 'text-danger' : 'text-text')}>
            {ERROR_MESSAGES[reason]}
          </p>
          {isForgedAsset ? (
            <span
              aria-hidden="true"
              className="inline-block h-4 w-px bg-[var(--color-danger)] motion-safe:animate-pulse"
            />
          ) : null}
        </div>

        {retryable ? (
          <Button aria-label="RETRY" className="min-w-40" onClick={onRetry} variant="secondary">
            RETRY
          </Button>
        ) : null}
      </div>
    </motion.section>
  );
}

function DangerIcon({ pulse }: { pulse: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={joinClasses(
        'h-24 w-24 text-danger drop-shadow-[0_0_14px_rgba(229,72,77,0.28)]',
        pulse ? 'motion-safe:animate-pulse' : undefined,
      )}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M48 12L86 80H10L48 12Z" stroke="currentColor" strokeWidth="4" />
      <path d="M48 34V56" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
      <circle cx="48" cy="67" r="3.5" fill="currentColor" />
    </svg>
  );
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}
