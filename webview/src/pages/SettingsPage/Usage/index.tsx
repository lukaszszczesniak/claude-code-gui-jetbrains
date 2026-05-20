import { SettingSection } from '../common';
import { ROUTE_META, Route } from '@/router/routes';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useUsageData } from './useUsageData';
import { UsageMeter } from './UsageMeter';
import { CcbNotInstalledNotice } from './CcbNotInstalledNotice';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1m ago';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1h ago';
  return `${diffHours}h ago`;
}

function UsageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-3 w-24 bg-surface-overlay rounded mb-4 animate-pulse" />
        <div className="bg-surface-raised rounded-lg border border-border-default p-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-28 bg-surface-overlay rounded animate-pulse" />
              <div className="h-4 w-10 bg-surface-overlay rounded animate-pulse" />
            </div>
            <div className="h-1 bg-surface-overlay rounded-full animate-pulse" />
            <div className="h-3 w-36 bg-surface-overlay rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div>
        <div className="h-3 w-20 bg-surface-overlay rounded mb-4 animate-pulse" />
        <div className="bg-surface-raised rounded-lg border border-border-default p-4">
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-surface-overlay rounded animate-pulse" />
                  <div className="h-4 w-10 bg-surface-overlay rounded animate-pulse" />
                </div>
                <div className="h-1 bg-surface-overlay rounded-full animate-pulse" />
                <div className="h-3 w-40 bg-surface-overlay rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsageSettings() {
  const meta = ROUTE_META[Route.SETTINGS_USAGE];
  const { data, isLoading, error, errorKind, lastUpdated, refresh } = useUsageData();

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

      {error && errorKind === 'ccb_missing' ? (
        <CcbNotInstalledNotice onRetry={refresh} isLoading={isLoading} />
      ) : error ? (
        <div className="mb-6 p-3 bg-state-error-bg border border-state-error-border rounded-lg text-sm text-state-error-fg">
          {error}
        </div>
      ) : null}

      {isLoading && !data ? (
        <UsageSkeleton />
      ) : data ? (
        <>
          {data.five_hour && (
            <SettingSection title="Current Session">
              <UsageMeter
                label="Current Session"
                utilization={data.five_hour.utilization}
                resetsAt={data.five_hour.resets_at}
              />
            </SettingSection>
          )}

          <SettingSection title="Weekly Limits">
            {data.seven_day && (
              <UsageMeter
                label="All Models"
                utilization={data.seven_day.utilization}
                resetsAt={data.seven_day.resets_at}
              />
            )}
            {data.seven_day_sonnet && (
              <UsageMeter
                label="Sonnet only"
                utilization={data.seven_day_sonnet.utilization}
                resetsAt={data.seven_day_sonnet.resets_at}
              />
            )}
            {data.seven_day_opus && (
              <UsageMeter
                label="Opus only"
                utilization={data.seven_day_opus.utilization}
                resetsAt={data.seven_day_opus.resets_at}
              />
            )}
          </SettingSection>

          <div className="mb-8">
            <a
              href="https://docs.anthropic.com/en/docs/about-claude/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-link hover:text-text-link hover:underline"
            >
              Learn more about usage limits
            </a>
          </div>
        </>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        {lastUpdated && (
          <span>Last updated: {formatRelativeTime(lastUpdated)}</span>
        )}
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
