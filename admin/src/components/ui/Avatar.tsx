import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  tone?: 'primary' | 'driver';
  className?: string;
}

export function Avatar({ src, firstName, lastName, size = 36, tone = 'primary', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn('rounded-full object-cover shrink-0', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        tone === 'primary' ? 'bg-primary-light text-primary-dark' : 'bg-driver-light text-driver-dark',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
