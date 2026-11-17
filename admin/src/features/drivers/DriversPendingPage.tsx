import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconChevronRight, IconShieldCheck, IconCar } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/utils';
import { fetchPendingDrivers } from './api';

export function DriversPendingPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['drivers', 'pending'],
    queryFn: fetchPendingDrivers,
    refetchInterval: 30_000,
  });

  return (
    <AppShell
      title="Vérification chauffeurs"
      description={data ? `${data.count} chauffeur${data.count > 1 ? 's' : ''} en attente de vérification` : undefined}
    >
      {isLoading && <PageSpinner />}

      {isError && (
        <Card className="p-8">
          <EmptyState title="Impossible de charger la file" description="Vérifie ta connexion et réessaie." />
        </Card>
      )}

      {data && data.data.length === 0 && (
        <Card>
          <EmptyState
            icon={<IconShieldCheck />}
            title="Aucun chauffeur en attente"
            description="Tous les dossiers ont été traités. Reviens plus tard."
          />
        </Card>
      )}

      {data && data.data.length > 0 && (
        <div className="grid gap-3">
          {data.data.map((driver) => (
            <Link key={driver.id} to={`/chauffeurs/${driver.userId}`}>
              <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-raised">
                <Avatar src={driver.avatarUrl} firstName={driver.firstName} lastName={driver.lastName} size={44} tone="driver" />

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {driver.firstName} {driver.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{driver.phone}</p>
                </div>

                <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                  <IconCar className="h-4 w-4" />
                  {driver.vehicleBrand ? `${driver.vehicleBrand} ${driver.vehicleModel ?? ''}`.trim() : 'Véhicule non renseigné'}
                </div>

                <Badge tone="warning">Inscrit {formatRelativeTime(driver.createdAt)}</Badge>

                <IconChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
