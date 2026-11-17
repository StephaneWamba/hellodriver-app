import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
}

/** Steering wheel over a skyline silhouette — mirrors the mobile app's HdLogo. */
export function Logo({ size = 40, className }: LogoProps) {
  const radius = size * 0.22;
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden bg-primary shadow-[0_4px_12px_rgba(45,201,160,0.35)]', className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg
        className="absolute inset-x-0 bottom-0 opacity-20"
        style={{ height: size * 0.5, width: size }}
        viewBox="0 0 100 40"
        preserveAspectRatio="xMidYMax slice"
        fill="white"
      >
        <rect x="2" y="18" width="10" height="22" />
        <rect x="16" y="10" width="10" height="30" />
        <rect x="30" y="22" width="8" height="18" />
        <polygon points="46,4 54,4 54,20 58,20 50,4 42,20 46,20" />
        <rect x="60" y="14" width="9" height="26" />
        <rect x="73" y="24" width="10" height="16" />
        <rect x="87" y="8" width="10" height="32" />
      </svg>
      <svg
        className="absolute inset-0 m-auto"
        style={{ width: size * 0.6, height: size * 0.6 }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="6.2" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.7" stroke="white" strokeWidth="1.7" />
        <line x1="12" y1="5.8" x2="12" y2="9.3" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="12" y1="14.7" x2="7.4" y2="17.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="12" y1="14.7" x2="16.6" y2="17.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
