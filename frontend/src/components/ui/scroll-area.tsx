import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

export function ScrollArea({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('relative max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gw-primary/60', className)}>
      {children}
    </div>
  );
}
