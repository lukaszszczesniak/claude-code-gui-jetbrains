import { useEffect } from 'react';
import { Portal } from '../Portal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: Props) {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
  } = props;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const confirmButtonClass =
    variant === 'danger'
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-state-error-fg hover:bg-state-error-fg text-text-inverse transition-colors'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary-hover hover:bg-accent-primary text-text-primary transition-colors';

  return (
    <Portal>
      <div
        data-testid="confirm-dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={handleBackdropClick}
      >
        <div
          role="dialog"
          className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
        >
          <h2 className="text-md font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary">{message}</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tooltip transition-colors"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className={confirmButtonClass}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
