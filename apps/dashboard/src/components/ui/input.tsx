import type { InputHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

/** shadcn-style form controls themed for deep-ocean futurist (ADR-031). */
const fieldClasses =
  'w-full rounded-(--radius-control) border border-(--input) bg-[rgba(7,10,18,0.85)] px-2.5 py-2 text-[0.9rem] text-(--color-foreground) transition-all placeholder:text-(--color-muted-foreground)/60 hover:border-[#2c3a55] focus:border-(--color-primary) focus:shadow-[0_0_0_3px_rgba(34,211,238,0.14)] focus:outline-none disabled:opacity-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClasses, 'min-h-[120px]', className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-[0.76rem] font-medium tracking-[0.02em] text-(--color-muted-foreground)',
        className,
      )}
      {...props}
    />
  );
}
