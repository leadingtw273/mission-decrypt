import { motion } from 'framer-motion';

import type { DecryptErrorReason } from '../crypto';
import { Button } from './shared/Button';
import { FrameBracket } from './shared/FrameBracket';
import { usePrefersReducedMotion } from './shared/usePrefersReducedMotion';

type ErrorModalProps = {
  reason: DecryptErrorReason;
  onRetry: () => void;
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

const ERROR_HINTS: Partial<Record<DecryptErrorReason, string>> = {
  auth_failed: 'Game ID 與 personal key 配對失敗，請重新確認。',
  invalid_personal_key_format: 'Personal key 格式錯誤；應為 4 段 4 字元（例 XXXX-XXXX-XXXX-XXXX）。',
  not_found: '伺服器上找不到此任務；可能是 mission_id 拼錯或尚未部署。',
};

export function ErrorModal({ reason, onRetry }: ErrorModalProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const hint = ERROR_HINTS[reason];

  return (
    <div
      aria-modal="true"
      aria-live="assertive"
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="alertdialog"
    >
      <motion.div
        animate={{ opacity: 1 }}
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(6,5,2,0.55)] backdrop-blur-sm"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      />

      <motion.div
        animate={
          prefersReducedMotion
            ? { opacity: 1, scale: 1 }
            : {
                opacity: 1,
                scale: 1,
                x: [0, -8, 8, -4, 4, 0],
              }
        }
        className="relative z-10 w-full max-w-md"
        initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
      >
        <FrameBracket
          size={26}
          color="var(--color-danger)"
          className="border border-[var(--color-danger)] bg-bg-primary/95 px-6 py-7 shadow-[0_0_50px_rgba(229,72,77,0.25)]"
        >
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <DangerIcon />
            <p className="font-display text-base font-bold tracking-[0.2em] text-danger md:text-lg">
              {ERROR_MESSAGES[reason]}
            </p>
            {hint ? (
              <p className="font-body max-w-sm text-sm leading-relaxed text-text/85">{hint}</p>
            ) : null}
            <Button
              aria-label="RETRY"
              className="min-w-40"
              onClick={onRetry}
              variant="primary"
            >
              RETRY
            </Button>
          </div>
        </FrameBracket>
      </motion.div>
    </div>
  );
}

function DangerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-16 text-danger drop-shadow-[0_0_14px_rgba(229,72,77,0.4)]"
      fill="none"
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M48 12L86 80H10L48 12Z" stroke="currentColor" strokeWidth="4" />
      <path d="M48 34V56" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
      <circle cx="48" cy="67" r="3.5" fill="currentColor" />
    </svg>
  );
}
