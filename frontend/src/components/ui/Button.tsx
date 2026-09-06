import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#00A859] hover:bg-[#00924D] text-white shadow-none',
    outline: 'border-2 border-[#00A859] text-[#00A859] hover:bg-[#E8F8EE] bg-transparent',
    secondary: 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-800 rounded-xl',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white rounded-xl',
    ghost: 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-xs sm:text-sm',
    lg: 'px-6 py-2.5 text-sm sm:text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-3.5 h-3.5 mr-2 border-2 border-current border-r-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};
