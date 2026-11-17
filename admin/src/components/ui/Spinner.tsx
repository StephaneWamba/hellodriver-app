import { cn } from '@/lib/utils';

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={cn('animate-spin text-primary', className)}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3.5a4.5 4.5 0 00-4.5 4.5H4z" />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[240px] w-full items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}
