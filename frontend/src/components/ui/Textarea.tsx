import React, { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  className = '',
  rows = 4,
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-3.5 py-2.5 bg-[#F3F4F6] border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00A859] focus:bg-white transition-colors resize-none ${
          error ? 'border-rose-500 focus:border-rose-500' : 'border-transparent'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
    </div>
  );
};
