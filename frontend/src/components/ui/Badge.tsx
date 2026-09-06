import React from 'react';
import { EmailStatus } from '../../lib/types';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange';
  status?: EmailStatus | string;
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  status,
  children,
  className = '',
}) => {
  let resolvedVariant = variant || 'default';
  let label = children;

  if (status) {
    const normalized = String(status).toUpperCase();
    label = children || (normalized === 'SCHEDULED' ? 'Scheduled' : normalized === 'SENT' ? 'Sent' : normalized);

    switch (normalized) {
      case 'SCHEDULED':
        resolvedVariant = 'orange';
        break;
      case 'QUEUED':
        resolvedVariant = 'info';
        break;
      case 'SENDING':
        resolvedVariant = 'info';
        break;
      case 'SENT':
        resolvedVariant = 'success';
        break;
      case 'FAILED':
        resolvedVariant = 'danger';
        break;
      case 'RESCHEDULED':
        resolvedVariant = 'warning';
        break;
      default:
        resolvedVariant = 'default';
        break;
    }
  }

  const variants = {
    default: 'bg-[#F1F3F5] text-gray-700 border-transparent',
    orange: 'bg-[#FEF3E8] text-[#E66E00] border-[#FCDDC2]',
    success: 'bg-[#E8F8EE] text-[#00A859] border-[#CEEED8]',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-600 border-rose-200',
    info: 'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${variants[resolvedVariant]} ${className}`}
    >
      {label}
    </span>
  );
};
