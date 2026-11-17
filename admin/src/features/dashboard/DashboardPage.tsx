import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { IconChevronRight, IconShieldCheck } from '@/components/ui/icons';
import { fetchPendingDrivers } from '@/features/drivers/api';
import { useAuth } from '@/features/auth/AuthProvider';

export function DashboardPage() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['drivers', 'pending'], queryFn: fetchPendingDrivers });
  const firstName = user?.name?.split(' ')[0];

  return (
    <AppShell title="Tableau de bord" description={firstName ? `Bonjour ${firstName}` : undefined}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/chauffeurs">
          <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-raised">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-light text-warning">
              <IconShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-semibold text-ink">{data?.count ?? '—'}</p>
              <p className="text-sm text-muted-foreground">Chauffeurs à vérifier</p>
            </div>
            <IconChevronRight className="h-4 w-4 text-muted" />
          </Card>
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        D'autres indicateurs (courses du jour, revenu plateforme, chauffeurs en ligne) arrivent avec les prochains modules.
      </p>
    </AppShell>
  );
}
