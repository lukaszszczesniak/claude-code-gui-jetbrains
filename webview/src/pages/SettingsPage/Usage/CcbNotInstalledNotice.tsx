import { useState } from 'react';

interface Props {
  onRetry: () => void;
  isLoading: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

const INSTALL_CMD = 'npm install -g claude-code-battery';

export function CcbNotInstalledNotice(props: Props) {
  const { onRetry, isLoading } = props;
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  const copyLabel = copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy';

  return (
    <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <h3 className="text-sm font-semibold text-zinc-100 mb-2">
        Usage feature requires claude-code-battery CLI
      </h3>
      <p className="text-sm text-zinc-400 mb-3">
        Install it globally via npm to enable real-time usage tracking:
      </p>
      <div className="flex items-center gap-2 mb-3 p-2 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs text-zinc-300">
        <code className="flex-1">{INSTALL_CMD}</code>
        <button
          onClick={copy}
          className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          {copyLabel}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        After installing, restart the IDE if it was running before the install.
      </p>
      <button
        onClick={onRetry}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Checking...' : 'Retry'}
      </button>
    </div>
  );
}
