import { ActiveFile } from '../../../types/chatInput';

interface FileTagProps {
  file: ActiveFile;
  onClick?: (path: string) => void;
}

export function FileTag({ file, onClick }: FileTagProps) {
  return (
    <button
      type="button"
      className={`
        inline-flex items-center gap-1 text-xs
        transition-opacity hover:opacity-70 cursor-pointer
        ${file.isSelected ? 'text-text-link' : 'text-text-tertiary'}
      `}
      onClick={() => onClick?.(file.path)}
      title={file.path}
    >
      <span className="text-text-disabled">&lt;/&gt;</span>
      <span className="truncate max-w-[120px]">{file.fileName}</span>
    </button>
  );
}
