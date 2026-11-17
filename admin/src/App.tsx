import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { PageSpinner } from '@/components/ui/Spinner';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DriversPendingPage } from '@/features/drivers/DriversPendingPage';
import { DriverDetailPage } from '@/features/drivers/DriverDetailPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { UserDetailPage } from '@/features/users/UserDetailPage';
import { FinancesPage } from '@/features/finances/FinancesPage';
import { TripsPage } from '@/features/trips/TripsPage';
import { TripDetailPage } from '@/features/trips/TripDetailPage';
import { PromosPage } from '@/features/promos/PromosPage';
import { AgentPage } from '@/features/agent/AgentPage';

// Leaflet pulls in a sizeable chunk (~150kB) only needed on this one page —
// code-split it so it doesn't inflate the initial bundle every admin loads.
const LiveMapPage = lazy(() => import('@/features/map/LiveMapPage').then((m) => ({ default: m.LiveMapPage })));

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster position="top-right" richColors closeButton />
          <BrowserRouter>
            <Routes>
              <Route path="/connexion" element={<LoginRoute />} />
              <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/chauffeurs" element={<RequireAuth><DriversPendingPage /></RequireAuth>} />
              <Route path="/chauffeurs/:driverId" element={<RequireAuth><DriverDetailPage /></RequireAuth>} />
              <Route
                path="/carte"
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageSpinner />}>
                      <LiveMapPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route path="/courses" element={<RequireAuth><TripsPage /></RequireAuth>} />
              <Route path="/courses/:tripId" element={<RequireAuth><TripDetailPage /></RequireAuth>} />
              <Route path="/finances" element={<RequireAuth><FinancesPage /></RequireAuth>} />
              <Route path="/utilisateurs" element={<RequireAuth><UsersPage /></RequireAuth>} />
              <Route path="/utilisateurs/:userId" element={<RequireAuth><UserDetailPage /></RequireAuth>} />
              <Route path="/parrainage" element={<RequireAuth><PromosPage /></RequireAuth>} />
              <Route path="/agent" element={<RequireAuth><AgentPage /></RequireAuth>} />
              <Route path="/parametres" element={<RequireAuth><SettingsPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
