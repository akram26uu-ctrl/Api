/**
 * ORDIUM Reusable Button Component
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#43D9E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A10] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-[#6C63F5] hover:bg-[#7770FF] text-white shadow-md shadow-[#6C63F5]/20 active:scale-[0.99]',
    secondary: 'bg-[#0D1320] hover:bg-[#161f33] text-[#F8FAFC] border border-white/10 active:scale-[0.99]',
    outline: 'bg-transparent hover:bg-white/5 text-[#F8FAFC] border border-white/15 active:scale-[0.99]',
    ghost: 'bg-transparent hover:bg-white/5 text-[#94A3B8] hover:text-white',
    danger: 'bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30'
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
