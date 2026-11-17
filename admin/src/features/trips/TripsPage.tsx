import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { IconRoute, IconChevronRight } from '@/components/ui/icons';
import { formatDate, formatXaf } from '@/lib/utils';
import { fetchTrips } from './api';

export const TRIP_STATUS_LABEL: Record<string, string> = {
  pending_bids: 'En attente de bids',
  bid_accepted: 'Bid accepté',
  driver_en_route: 'Chauffeur en route',
  driver_arrived: 'Chauffeur arrivé',
  in_transit: 'En course',
  completed: 'Terminée',
  rated: 'Notée',
  cancelled_by_client: 'Annulée (client)',
  cancelled_by_driver: 'Annulée (chauffeur)',
  cancelled_by_admin: 'Annulée (admin)',
  no_bids: 'Aucun bid',
  driver_no_show: 'Chauffeur absent',
  expired: 'Expirée',
  payment_failed: 'Paiement échoué',
};

export const TRIP_STATUS_TONE: Record<string, BadgeTone> = {
  pending_bids: 'warning',
  bid_accepted: 'primary',
  driver_en_route: 'primary',
  driver_arrived: 'primary',
  in_transit: 'primary',
  completed: 'success',
  rated: 'success',
  cancelled_by_client: 'danger',
  cancelled_by_driver: 'danger',
  cancelled_by_admin: 'danger',
  no_bids: 'neutral',
  driver_no_show: 'danger',
  expired: 'neutral',
  payment_failed: 'danger',
};

export function TripsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['trips', status, page],
    queryFn: () => fetchTrips({ status: status || undefined, page }),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell title="Courses & litiges" description="Historique et suivi de toutes les courses de la plateforme">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-ink">Toutes les courses</p>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && <Spinner size={16} />}
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 w-56"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(TRIP_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>

        {isLoading && !data ? (
          <PageSpinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={<IconRoute />} title="Aucune course" description="Aucune course ne correspond à ce filtre." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Chauffeur</th>
                    <th className="px-5 py-3 font-medium">Trajet</th>
                    <th className="px-5 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 font-medium">Montant</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-5 py-3 font-medium text-ink">{t.clientFirstName} {t.clientLastName}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {t.driverFirstName ? `${t.driverFirstName} ${t.driverLastName}` : '—'}
                      </td>
                      <td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground">
                        {t.originAddress ?? 'Départ'} → {t.destinationAddress ?? 'Arrivée'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={TRIP_STATUS_TONE[t.status] ?? 'neutral'}>{TRIP_STATUS_LABEL[t.status] ?? t.status}</Badge>
                      </td>
                      <td className="px-5 py-3 font-medium text-ink">
                        {formatXaf(t.finalFareXaf ?? t.fareEstimateXaf ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                      <td className="px-5 py-3">
                        <Link to={`/courses/${t.id}`}>
                          <IconChevronRight className="h-4 w-4 text-muted" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {data.total} course{data.total > 1 ? 's' : ''} · page {data.page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
