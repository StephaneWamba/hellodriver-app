import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // React Router doesn't reset scroll position on navigation the way a
  // full page load does — without this, a page can render already
  // scrolled past its own top, showing the sticky header overlapping
  // content instead of the page starting from its top.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-surface-sunken">
      <Sidebar />
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1360px] items-center justify-between px-8 py-5">
            <div>
              <h1 className="font-display text-xl font-semibold text-ink">{title}</h1>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>
        <main className="animate-fade-in px-8 py-6">
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
