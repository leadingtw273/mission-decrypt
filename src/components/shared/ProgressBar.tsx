type ProgressBarProps =
  | {
      progress: number;
      indeterminate?: false;
    }
  | {
      progress?: never;
      indeterminate: true;
    };

const SEGMENT_COUNT = 10;

export function ProgressBar(props: ProgressBarProps) {
  const indeterminate = props.indeterminate === true;
  const progress = indeterminate ? 0 : clamp(props.progress, 0, 1);
  const filledSegments = indeterminate ? SEGMENT_COUNT : Math.round(progress * SEGMENT_COUNT);

  return (
    <div
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuenow={indeterminate ? undefined : Math.round(progress * 100)}
      aria-valuetext={indeterminate ? 'Loading' : `${Math.round(progress * 100)}%`}
      className="flex gap-1"
      role="progressbar"
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
        const isFilled = index < filledSegments;
        const isAnimated = indeterminate;

        return (
          <span
            className={joinClasses(
              'block h-2 flex-1 border border-border bg-bg-secondary',
              isFilled ? 'bg-primary' : undefined,
              isAnimated ? 'progress-segment-indeterminate' : undefined,
            )}
            data-animated={isAnimated ? 'true' : 'false'}
            data-filled={isFilled ? 'true' : 'false'}
            data-testid="progress-segment"
            key={index}
          />
        );
      })}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}
