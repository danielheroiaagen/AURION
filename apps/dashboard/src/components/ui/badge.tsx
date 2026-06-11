import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

/** shadcn-style badge with the status glow dot (ADR-031). */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold tracking-[0.02em] before:size-[5px] before:rounded-full before:bg-current before:shadow-[0_0_6px_currentColor] before:content-[""]',
  {
    variants: {
      tone: {
        neutral: 'border-(--color-border) bg-(--color-surface-2) text-(--color-muted-foreground)',
        ok: 'border-(--color-ok)/40 bg-(--color-ok)/10 text-(--color-ok)',
        warn: 'border-(--color-warn)/40 bg-(--color-warn)/10 text-(--color-warn)',
        danger: 'border-(--color-danger)/40 bg-(--color-danger)/10 text-(--color-danger)',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
