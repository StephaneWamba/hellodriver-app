import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconChevronRight, IconPhone, IconMap, IconAlertTriangle } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { formatDate, formatXaf } from '@/lib/utils';
import { adminCancelTrip, fetchTripDetail } from './api';
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE } from './TripsPage';

const CANCELLABLE_STATUSES = ['pending_bids', 'bid_accepted', 'driver_en_route', 'driver_arrived', 'in_transit'];

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Non payé',
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

const BID_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  expired: 'Expiré',
};

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => fetchTripDetail(tripId!),
    enabled: !!tripId,
  });

  const cancelMutation = useMutation({
    mutationFn: () => adminCancelTrip(tripId!, cancelReason.trim()),
    onSuccess: () => {
      toast.success('Course annulée — remboursement effectué si la course était payée');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setCancelDialogOpen(false);
      setCancelReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec de l'annulation"),
  });

  if (isLoading) {
    return (
      <AppShell title="Course">
        <PageSpinner />
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell title="Course introuvable">
        <Card className="p-8 text-center text-sm text-muted-foreground">Cette course n'existe pas ou plus.</Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Course du ${formatDate(trip.createdAt)}`}
      actions={
        CANCELLABLE_STATUSES.includes(trip.status) ? (
          <Button variant="danger" onClick={() => setCancelDialogOpen(true)}>
            <IconAlertTriangle className="h-4 w-4" /> Annuler la course
          </Button>
        ) : undefined
      }
    >
      <div className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-ink">Courses & litiges</Link>
        <IconChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink">Détail</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge tone={TRIP_STATUS_TONE[trip.status] ?? 'neutral'}>
                  {TRIP_STATUS_LABEL[trip.status] ?? trip.status}
                </Badge>
                <Badge tone={trip.paymentStatus === 'paid' ? 'success' : trip.paymentStatus === 'failed' ? 'danger' : 'neutral'}>
                  {PAYMENT_STATUS_LABEL[trip.paymentStatus] ?? trip.paymentStatus}
                </Badge>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <IconMap className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <div className="space-y-1.5">
                  <p className="text-ink">{trip.originAddress ?? 'Adresse de départ inconnue'}</p>
                  <p className="text-muted-foreground">↓</p>
                  <p className="text-ink">{trip.destinationAddress ?? "Adresse d'arrivée inconnue"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Montants</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Estimé" value={trip.fareEstimateXaf != null ? formatXaf(trip.fareEstimateXaf) : '—'} />
              <Row label="Final" value={trip.finalFareXaf != null ? formatXaf(trip.finalFareXaf) : '—'} />
              {trip.clientRating != null && (
                <Row label="Note client" value={`${trip.clientRating} / 5`} />
              )}
            </CardContent>
          </Card>

          {trip.clientComment && (
            <Card>
              <CardHeader><CardTitle>Commentaire du client</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{trip.clientComment}</CardContent>
            </Card>
          )}

          {trip.adminCancellationReason && (
            <Card className="border-danger/30 bg-danger-light">
              <CardHeader><CardTitle className="text-danger">Annulée par un admin</CardTitle></CardHeader>
              <CardContent className="text-sm text-danger">{trip.adminCancellationReason}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Client</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-3">
                <Avatar firstName={trip.clientFirstName} lastName={trip.clientLastName} size={44} />
                <div className="min-w-0">
                  <Link to={`/utilisateurs/${trip.clientId}`} className="font-medium text-ink hover:underline">
                    {trip.clientFirstName} {trip.clientLastName}
                  </Link>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconPhone className="h-3.5 w-3.5" /> {trip.clientPhone}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Chauffeur</CardTitle></CardHeader>
              <CardContent>
                {trip.driverId ? (
                  <div className="flex items-center gap-3">
                    <Avatar firstName={trip.driverFirstName} lastName={trip.driverLastName} size={44} tone="driver" />
                    <div className="min-w-0">
                      <Link to={`/utilisateurs/${trip.driverId}`} className="font-medium text-ink hover:underline">
                        {trip.driverFirstName} {trip.driverLastName}
                      </Link>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <IconPhone className="h-3.5 w-3.5" /> {trip.driverPhone}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun chauffeur assigné</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Bids reçus ({trip.bids.length})</CardTitle></CardHeader>
            {trip.bids.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun bid pour cette course.</p>
            ) : (
              <div className="divide-y divide-border">
                {trip.bids.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <Link to={`/utilisateurs/${b.driverId}`} className="font-medium text-ink hover:underline">
                        {b.driverFirstName} {b.driverLastName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(b.createdAt)} · ETA {b.etaMinutes} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{formatXaf(b.amountXaf)}</span>
                      <Badge tone={b.status === 'accepted' ? 'success' : b.status === 'rejected' ? 'danger' : 'neutral'}>
                        {BID_STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Annuler cette course"
        description="Le client sera remboursé automatiquement si la course était déjà payée. Cette action est définitive."
      >
        <div className="space-y-3 p-5">
          <textarea
            autoFocus
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motif de l'annulation (litige, incident…)"
            className="w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-danger/25 focus:border-danger"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>Retour</Button>
            <Button
              variant="danger"
              disabled={cancelReason.trim().length < 3}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Confirmer l'annulation
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
