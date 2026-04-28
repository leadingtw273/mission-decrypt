export function ScannerSweep() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="scanner-sweep"
    >
      <div className="scanner-sweep-line absolute left-0 right-0 h-px" />
    </div>
  );
}
