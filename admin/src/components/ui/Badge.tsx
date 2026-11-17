import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'driver';
type Tone = BadgeTone;

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-muted-foreground border-border',
  success: 'bg-success-light text-success border-success/20',
  warning: 'bg-warning-light text-warning border-warning/25',
  danger: 'bg-danger-light text-danger border-danger/20',
  primary: 'bg-primary-light text-primary-dark border-primary/20',
  driver: 'bg-driver-light text-driver-dark border-driver/20',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
