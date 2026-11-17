import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconX } from './icons';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideHeader?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Dialog({ open, onOpenChange, title, description, children, size = 'md', hideHeader }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px] animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[92vw] -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl bg-white shadow-popover animate-slide-up focus:outline-none',
            'max-h-[88vh] flex flex-col',
            sizeClasses[size]
          )}
        >
          {!hideHeader && (
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                {title && (
                  <RadixDialog.Title className="text-sm font-semibold text-ink">{title}</RadixDialog.Title>
                )}
                {description && (
                  <RadixDialog.Description className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close className="rounded-lg p-1.5 text-muted hover:bg-surface-sunken hover:text-ink transition-colors">
                <IconX className="h-4 w-4" />
              </RadixDialog.Close>
            </div>
          )}
          <div className="overflow-y-auto scrollbar-thin">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
