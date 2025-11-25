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
        'rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-gw-stroke',
        'transition-colors duration-200 p-5',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-gw-stroke pb-3">
          <div>
            {title ? <p className="text-sm font-semibold text-gw-text">{title}</p> : null}
            {description ? <p className="text-xs text-gw-text/70">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="pt-3">{children}</div>
    </div>
  );
}
