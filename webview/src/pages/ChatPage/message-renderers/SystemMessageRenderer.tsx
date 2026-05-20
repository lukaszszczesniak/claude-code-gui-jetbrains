import React from 'react';
import { LoadedMessageDto, getTextContent } from '../../../types';

interface SystemMessageRendererProps {
  message: LoadedMessageDto;
}

export const SystemMessageRenderer: React.FC<SystemMessageRendererProps> = ({ message }) => {
  return (
    <div className="justify-center py-3 hidden">
      <div className="px-4 py-2 bg-surface-hover border border-border-default/50 rounded-lg text-[0.7692rem] text-text-secondary font-mono">
        {getTextContent(message)}
      </div>
    </div>
  );
};
