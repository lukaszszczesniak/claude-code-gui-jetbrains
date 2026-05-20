/**
 * Pure helper that determines whether a keydown event on the textarea should
 * trigger form submission, based on the useCtrlEnterToSend setting.
 *
 * Extracted for unit-testability without requiring full context setup.
 *
 * @param event - subset of KeyboardEvent properties needed for the decision
 * @param useCtrlEnterToSend - value of the ClaudeSettings toggle
 * @returns true when the key combo should submit the prompt
 */
export function shouldSubmitOnEnter(
  event: {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    isComposing: boolean;
    isMobile: boolean;
  },
  useCtrlEnterToSend: boolean,
): boolean {
  // Only applies to the Enter key
  if (event.key !== 'Enter') return false;

  // IME composition and mobile are always guarded on the submit path
  if (event.isComposing || event.isMobile) return false;

  if (useCtrlEnterToSend) {
    // Ctrl/Cmd+Enter sends; Shift+Enter and plain Enter insert newlines
    return (event.ctrlKey || event.metaKey) && !event.shiftKey;
  } else {
    // Default: Enter sends, Shift+Enter inserts a newline
    return !event.shiftKey;
  }
}
