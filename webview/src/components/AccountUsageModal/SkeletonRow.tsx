export function SkeletonRow() {
  return (
    <div className="py-3 border-b border-border-subtle last:border-b-0 space-y-2">
      <div className="flex justify-between">
        <div className="h-4 w-28 bg-surface-tooltip rounded animate-pulse" />
        <div className="h-4 w-10 bg-surface-tooltip rounded animate-pulse" />
      </div>
      <div className="h-1.5 bg-surface-tooltip rounded-full animate-pulse" />
      <div className="h-3 w-24 bg-surface-tooltip/60 rounded animate-pulse" />
    </div>
  );
}
