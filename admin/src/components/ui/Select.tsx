import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconChevronRight } from './icons';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink-soft">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'h-11 w-full appearance-none rounded-xl border border-border bg-white pl-3.5 pr-9 text-sm text-ink',
              'transition-shadow duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <IconChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted" />
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';
