import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
  }
>;

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-sky-500 to-cyan-300 text-slate-900 font-semibold border-transparent shadow-lg shadow-cyan-500/25',
  ghost:
    'bg-slate-800/60 text-slate-100 border border-slate-700 hover:border-slate-500 hover:bg-slate-800',
  outline:
    'bg-transparent text-slate-100 border border-slate-700 hover:border-cyan-300 hover:text-cyan-200',
  danger: 'bg-red-600 text-white border border-red-500 hover:bg-red-500',
};

export function Button({ children, className, variant = 'primary', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-0',
        variantStyles[variant],
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
