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
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ordium-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A10] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

  const sizeStyles = {
    sm: 'min-h-[40px] text-xs px-3 py-2 gap-1.5',
    md: 'min-h-[44px] text-sm px-4 py-2.5 gap-2',
    lg: 'min-h-[48px] text-base px-6 py-3 gap-2.5'
  };

  const variantStyles = {
    primary: 'bg-[var(--ordium-accent-fill)] hover:bg-[var(--ordium-accent-fill-hover)] text-white shadow-md shadow-[var(--ordium-accent)]/20 active:scale-[0.99]',
    secondary: 'bg-[var(--ordium-surface)] hover:bg-[#161f33] text-[#F8FAFC] border border-white/10 active:scale-[0.99]',
    outline: 'bg-transparent hover:bg-white/5 text-[#F8FAFC] border border-white/15 active:scale-[0.99]',
    ghost: 'bg-transparent hover:bg-white/5 text-[var(--ordium-muted)] hover:text-white',
    danger: 'bg-[var(--ordium-danger)]/15 hover:bg-[var(--ordium-danger)]/25 text-[var(--ordium-danger)] border border-[var(--ordium-danger)]/30'
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
