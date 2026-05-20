interface Props {
  showSubmitButton: boolean;
  canSubmit: boolean;
  isLastTab: boolean;
  onSubmit: () => void;
}

export const Footer = (props: Props) => {
  const { showSubmitButton, canSubmit, isLastTab, onSubmit } = props;

  return (
    <div className="border-t border-border-default/50 px-3 py-2 flex items-center justify-between">
      <span className="text-text-disabled text-xs">Esc to cancel</span>

      {showSubmitButton && (
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="px-3 py-1 rounded text-xs bg-accent-primary-hover text-text-primary hover:bg-accent-primary-pressed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLastTab ? 'Submit answers' : 'Next'}
        </button>
      )}
    </div>
  );
};
