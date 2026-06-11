import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

/** shadcn-style card: glass over the abyss (ADR-031). */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) shadow-(--shadow-card)',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_38%)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-5 pt-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-[0.95rem] font-semibold tracking-[-0.01em]', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-[0.8rem] text-(--color-muted-foreground)', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
