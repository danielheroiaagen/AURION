import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

/** shadcn-style button themed for deep-ocean futurist (ADR-031). */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-control) text-[0.85rem] font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-45 outline-none focus-visible:ring-2 focus-visible:ring-(--ring)',
  {
    variants: {
      variant: {
        default:
          'border border-(--color-border) bg-(--color-surface-2) text-(--color-foreground) hover:border-(--color-primary)/55 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.18)]',
        primary:
          'border-0 bg-[image:var(--brand-gradient)] text-[#051018] font-semibold hover:brightness-110 hover:shadow-(--shadow-glow)',
        danger:
          'border border-(--color-danger)/50 bg-(--color-danger)/5 text-(--color-danger) hover:bg-(--color-danger)/10',
        ghost: 'border-0 bg-transparent text-(--color-muted-foreground) hover:bg-(--color-surface-2) hover:text-(--color-foreground)',
      },
      size: {
        default: 'px-3.5 py-[0.42rem]',
        sm: 'px-2.5 py-1 text-[0.78rem]',
        lg: 'px-5 py-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
