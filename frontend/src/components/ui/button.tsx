import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'ghost' | 'accent' | 'danger';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
  }
>;

const variantStyles: Record<Variant, string> = {
  primary:
    'px-5 py-2.5 rounded-[10px] bg-[#10B981] text-white font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.12)] hover:bg-[#0EA66F] active:scale-[0.98] transition border border-[#10B981]',
  ghost:
    'px-5 py-2.5 rounded-[10px] bg-white text-[#374151] font-medium border-[1.5px] border-[#D1D5DB] hover:border-[#9CA3AF] hover:bg-slate-50 active:scale-[0.98] transition',
  accent:
    'px-5 py-2.5 rounded-[10px] bg-[#FEECE5] text-[#EB5A2A] font-semibold border-[1.5px] border-[#F8C7A2] hover:bg-[#FCD9C6] active:scale-[0.98] transition shadow-[0_2px_4px_rgba(0,0,0,0.08)]',
  danger:
    'px-5 py-2.5 rounded-[10px] bg-gw-danger text-white font-semibold hover:bg-gw-danger/90 active:scale-[0.98] transition border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.12)]',
};

export function Button({ children, className, variant = 'primary', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 text-sm transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-accent focus-visible:ring-offset-0',
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
