import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { PageSpinner } from '@/components/ui/Spinner';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-sunken">
        <PageSpinner />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}
