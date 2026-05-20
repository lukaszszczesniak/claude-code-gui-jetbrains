import { formatTimeUntil, formatExactTime } from './formatters';

interface UsageRowProps {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

function getBarColorClass(utilization: number): string {
  if (utilization >= 80) return 'bg-state-error-fg';
  if (utilization >= 50) return 'bg-state-warning-fg';
  return 'bg-accent-primary';
}

export function UsageRow({ label, utilization, resetsAt }: UsageRowProps) {
  const clamped = Math.min(100, Math.max(0, utilization));
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.9230rem] text-text-primary">{label}</span>
        <span className="text-[0.9230rem] text-text-primary">{Math.round(clamped)}%</span>
      </div>
      <div className="w-full h-1.5 bg-surface-tooltip/60 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColorClass(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {resetsAt && (
        <div className="flex items-center justify-between text-[0.8461rem] text-text-tertiary hover:text-text-primary transition-all">
          <span className="">{formatTimeUntil(resetsAt)}</span>
          <span className="">{formatExactTime(resetsAt)}</span>
        </div>
      )}
    </div>
  );
}
