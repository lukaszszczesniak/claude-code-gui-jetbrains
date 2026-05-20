interface InfoRowProps {
  label: string;
  value: string | null;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[0.9230rem] text-text-secondary">{label}</span>
      <span className="text-[0.9230rem] text-text-primary">{value ?? '—'}</span>
    </div>
  );
}

export function InfoRowSkeleton() {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="h-3 w-20 bg-surface-tooltip rounded animate-pulse" />
      <div className="h-3 w-24 bg-surface-tooltip rounded animate-pulse" />
    </div>
  );
}
