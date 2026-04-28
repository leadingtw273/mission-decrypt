import type { PropsWithChildren } from 'react';

type FrameBracketProps = PropsWithChildren<{
  size: number;
  color: string;
  className?: string;
}>;

export function FrameBracket({ size, color, className, children }: FrameBracketProps) {
  const resolvedColor = resolveColor(color);
  const cornerStyle = { width: size, height: size, color: resolvedColor } as const;

  return (
    <div className={joinClasses('relative inline-flex items-center justify-center', className)}>
      <div className="pointer-events-none absolute inset-0">
        <Corner className="left-0 top-0" position="top-left" style={cornerStyle} />
        <Corner className="right-0 top-0" position="top-right" style={cornerStyle} />
        <Corner className="bottom-0 left-0" position="bottom-left" style={cornerStyle} />
        <Corner className="bottom-0 right-0" position="bottom-right" style={cornerStyle} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Corner(
  { className, position, style }: { className: string; position: CornerPosition; style: { width: number; height: number; color: string } },
) {
  return (
    <svg
      aria-hidden="true"
      className={joinClasses('absolute', className)}
      data-testid="frame-bracket-corner"
      style={style}
      viewBox="0 0 24 24"
    >
      <path
        d={getCornerPath(position)}
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.5"
      />
    </svg>
  );
}

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function getCornerPath(position: CornerPosition) {
  switch (position) {
    case 'top-left':
      return 'M22 2H2v20';
    case 'top-right':
      return 'M2 2h20v20';
    case 'bottom-left':
      return 'M22 22H2V2';
    case 'bottom-right':
      return 'M2 22h20V2';
  }
}

function resolveColor(color: string) {
  if (color === 'primary') {
    return 'var(--color-primary)';
  }
  if (color === 'text') {
    return 'var(--color-text)';
  }
  return color;
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}
