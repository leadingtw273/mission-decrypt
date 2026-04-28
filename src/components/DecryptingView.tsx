import { motion } from 'framer-motion';

import { ProgressBar } from './shared/ProgressBar';
import { ScannerSweep } from './shared/ScannerSweep';
import { usePrefersReducedMotion } from './shared/usePrefersReducedMotion';

const TYPEWRITER_TEXT = 'DECRYPTING...';

export function DecryptingView() {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return (
      <section
        aria-live="polite"
        className="relative overflow-hidden border border-border bg-bg-secondary/60 px-6 py-10 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8"
        role="status"
      >
        <ScannerSweep />

        <div className="relative z-10 flex min-h-[26rem] flex-col items-center justify-center gap-8">
          <div
            className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary/25"
            data-motion="reduced"
          >
            <div className="absolute inset-3 rounded-full border border-dashed border-primary/35" />
            <div className="absolute inset-0 rounded-full border-t-2 border-primary border-r-2 border-r-primary/20 border-b-2 border-b-primary/10 border-l-2 border-l-primary/45" />
            <CheckmarkIcon />
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <span className="font-display inline-block whitespace-nowrap text-2xl text-primary md:text-3xl" data-motion="reduced">
              {TYPEWRITER_TEXT}
            </span>
            <p className="sr-only">Decrypting transmission, please wait</p>
            <p aria-hidden="true" className="font-body max-w-md text-sm text-text/75">
              Decrypting transmission, please wait
            </p>
          </div>

          <div className="w-full max-w-xl">
            <ProgressBar indeterminate />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden border border-border bg-bg-secondary/60 px-6 py-10 shadow-[0_0_40px_rgba(255,186,0,0.06)] md:px-8"
      role="status"
    >
      <ScannerSweep />

      <div className="relative z-10 flex min-h-[26rem] flex-col items-center justify-center gap-8">
        <motion.div
          animate={
            prefersReducedMotion
              ? { rotate: 0, scale: 1 }
              : { rotate: 360, scale: [1, 1.04, 1] }
          }
          className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary/25"
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 1.4, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
          }
        >
          <div className="absolute inset-3 rounded-full border border-dashed border-primary/35" />
          <div className="absolute inset-0 rounded-full border-t-2 border-primary border-r-2 border-r-primary/20 border-b-2 border-b-primary/10 border-l-2 border-l-primary/45" />
          <CheckmarkIcon />
        </motion.div>

        <div className="flex flex-col items-center gap-3 text-center">
          <motion.span
            animate={
              prefersReducedMotion
                ? { width: 'auto', opacity: 1 }
                : { width: `${TYPEWRITER_TEXT.length}ch`, opacity: 1 }
            }
            className="font-display inline-block overflow-hidden whitespace-nowrap text-2xl text-primary md:text-3xl"
            initial={prefersReducedMotion ? false : { width: '0ch', opacity: 0.65 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 1.2, ease: 'linear', repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.35 }
            }
          >
            {TYPEWRITER_TEXT}
          </motion.span>
          <p className="sr-only">Decrypting transmission, please wait</p>
          <p aria-hidden="true" className="font-body max-w-md text-sm text-text/75">
            Decrypting transmission, please wait
          </p>
        </div>

        <div className="w-full max-w-xl">
          <ProgressBar indeterminate />
        </div>
      </div>
    </section>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-14 w-14 text-primary drop-shadow-[0_0_14px_rgba(255,186,0,0.28)]"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 33L28 43L46 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
    </svg>
  );
}
