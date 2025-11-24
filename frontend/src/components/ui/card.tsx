import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type CardProps = PropsWithChildren<{
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}>;

export function Card({ className, children, title, description, action }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800/80 bg-surface shadow-card backdrop-blur-sm',
        'transition-colors duration-200',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            {title ? <p className="text-sm font-semibold text-slate-100">{title}</p> : null}
            {description ? <p className="text-xs text-slate-400">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
