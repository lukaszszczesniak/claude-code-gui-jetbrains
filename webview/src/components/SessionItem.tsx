import { useState, useRef, useEffect } from 'react';
import { SessionMeta } from '../types';
import { formatRelativeTime, getMessagePreview } from '../utils/time';

interface SessionItemProps {
  session: SessionMeta;
  isActive: boolean;
  lastMessage?: string;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionItem({
  session,
  isActive,
  lastMessage,
  onSelect,
  onRename,
  onDelete,
}: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(session.title);
  };

  const handleRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(session.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(session.title);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const preview = lastMessage ? getMessagePreview(lastMessage) : 'No messages yet';
  const relativeTime = formatRelativeTime(session.updatedAt);

  return (
    <div
      onClick={() => !isEditing && onSelect(session.id)}
      onDoubleClick={handleDoubleClick}
      className={`
        relative px-3 py-2.5 cursor-pointer transition-all duration-150
        border-l-2
        ${isActive
          ? 'bg-surface-overlay border-border-focus'
          : 'border-transparent hover:bg-surface-hover'
        }
        group
      `}
    >
      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-surface-base backdrop-blur-sm flex items-center justify-center gap-2 z-10">
          <button
            onClick={handleConfirmDelete}
            className="px-3 py-1.5 bg-state-error-fg hover:bg-state-error-fg text-text-inverse text-xs font-medium rounded transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleCancelDelete}
            className="px-3 py-1.5 bg-surface-tooltip hover:bg-surface-pressed text-text-primary text-xs font-medium rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-start gap-2.5">
        {/* Session Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              className="w-full text-sm font-medium bg-surface-tooltip text-text-primary px-2 py-0.5 rounded border border-border-focus outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="text-sm font-medium text-text-primary truncate">
              {session.title}
            </h3>
          )}

          {/* Preview */}
          <p className="text-xs text-text-secondary truncate mt-0.5">
            {preview}
          </p>

          {/* Timestamp & Count */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-text-tertiary">
              {relativeTime}
            </span>
            {session.messageCount > 0 && (
              <>
                <span className="text-text-disabled">•</span>
                <span className="text-xs text-text-tertiary">
                  {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions (visible on hover) */}
        {!isEditing && !showDeleteConfirm && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDeleteClick}
              className="p-1 hover:bg-surface-tooltip rounded transition-colors"
              title="Delete session"
            >
              <svg className="w-4 h-4 text-text-secondary hover:text-state-error-fg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5zM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11zm1.958 1l-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
