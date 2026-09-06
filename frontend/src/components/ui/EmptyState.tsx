import React, { ReactNode } from 'react';
import { Mail } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-[#F9FAFB] border border-gray-100 my-6 ${className}`}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white text-gray-400 mb-4 border border-gray-200 shadow-xs">
        {icon || <Mail className="w-5 h-5 text-[#00A859]" />}
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">{description}</p>
      {action && <div className="flex items-center justify-center">{action}</div>}
    </div>
  );
};
