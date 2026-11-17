import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconCar, IconChevronRight, IconPhone, IconCheck, IconX } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { DocumentCard } from './DocumentCard';
import { DOCUMENT_LABELS, type DocumentType } from './types';
import {
  approveDocument,
  approveDriver,
  fetchDriverDocuments,
  fetchDriverProfile,
  rejectDocument,
  rejectDriver,
} from './api';

const REQUIRED_DOCS: DocumentType[] = ['drivers_license', 'id_card', 'vehicle_insurance'];

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
} as const;

const STATUS_LABEL = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
} as const;

export function DriverDetailPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const profileQuery = useQuery({
    queryKey: ['drivers', driverId, 'profile'],
    queryFn: () => fetchDriverProfile(driverId!),
    enabled: !!driverId,
  });

  const documentsQuery = useQuery({
    queryKey: ['drivers', driverId, 'documents'],
    queryFn: () => fetchDriverDocuments(driverId!),
    enabled: !!driverId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['drivers', driverId] });
    queryClient.invalidateQueries({ queryKey: ['drivers', 'pending'] });
  }

  const approveDocMutation = useMutation({
    mutationFn: (docId: string) => approveDocument(driverId!, docId),
    onSuccess: () => {
      toast.success('Document approuvé');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec de l'approbation"),
  });

  const rejectDocMutation = useMutation({
    mutationFn: ({ docId, reason }: { docId: string; reason: string }) => rejectDocument(driverId!, docId, reason),
    onSuccess: () => {
      toast.success('Document rejeté');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec du rejet'),
  });

  const approveDriverMutation = useMutation({
    mutationFn: () => approveDriver(driverId!),
    onSuccess: () => {
      toast.success('Chauffeur approuvé — il peut maintenant passer en ligne');
      invalidate();
      navigate('/chauffeurs');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec de l'approbation"),
  });

  const rejectDriverMutation = useMutation({
    mutationFn: (reason: string) => rejectDriver(driverId!, reason),
    onSuccess: () => {
      toast.success('Chauffeur rejeté');
      invalidate();
      navigate('/chauffeurs');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec du rejet'),
  });

  if (profileQuery.isLoading || documentsQuery.isLoading) {
    return (
      <AppShell title="Chauffeur">
        <PageSpinner />
      </AppShell>
    );
  }

  const driver = profileQuery.data;
  const documents = documentsQuery.data?.data ?? [];

  if (!driver) {
    return (
      <AppShell title="Chauffeur introuvable">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Ce chauffeur n'existe pas ou plus.
        </Card>
      </AppShell>
    );
  }

  const missingDocs = REQUIRED_DOCS.filter((t) => !documents.some((d) => d.documentType === t));

  return (
    <AppShell
      title={`${driver.firstName} ${driver.lastName}`}
      actions={
        driver.verificationStatus === 'pending' ? (
          <>
            <Button variant="outline" onClick={() => setRejectDialogOpen(true)} disabled={rejectDriverMutation.isPending}>
              <IconX className="h-4 w-4" /> Rejeter le dossier
            </Button>
            <Button
              onClick={() => approveDriverMutation.mutate()}
              loading={approveDriverMutation.isPending}
              disabled={missingDocs.length > 0}
              title={missingDocs.length > 0 ? 'Documents manquants' : undefined}
            >
              <IconCheck className="h-4 w-4" /> Approuver le chauffeur
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/chauffeurs" className="hover:text-ink">Vérification chauffeurs</Link>
        <IconChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink">{driver.firstName} {driver.lastName}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar src={driver.avatarUrl} firstName={driver.firstName} lastName={driver.lastName} size={72} tone="driver" />
              <div>
                <p className="text-base font-semibold text-ink">{driver.firstName} {driver.lastName}</p>
                <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <IconPhone className="h-3.5 w-3.5" /> {driver.phone}
                </p>
              </div>
              <Badge tone={STATUS_TONE[driver.verificationStatus]}>{STATUS_LABEL[driver.verificationStatus]}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Véhicule</CardTitle>
              <IconCar className="h-4 w-4 text-muted" />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Marque" value={driver.vehicleBrand} />
              <Row label="Modèle" value={driver.vehicleModel} />
              <Row label="Année" value={driver.vehicleYear ? String(driver.vehicleYear) : null} />
              <Row label="Immatriculation" value={driver.vehicleRegistration} />
              <Row label="Climatisé" value={driver.hasAc == null ? null : driver.hasAc ? 'Oui' : 'Non'} />
              <Row label="Quartier" value={driver.residentialArea} />
              <Row label="Mobile Money" value={driver.mobileMoneyAccount} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Inscrit le" value={formatDate(driver.createdAt)} />
              <Row label="Note moyenne" value={driver.ratingCount > 0 ? `${Number(driver.ratingAvg).toFixed(1)} / 5 (${driver.ratingCount})` : 'Aucune course'} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Documents ({documents.length}/3)</h2>
            {missingDocs.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Manquants : {missingDocs.map((d) => DOCUMENT_LABELS[d]).join(', ')}
              </span>
            )}
          </div>

          {documents.length === 0 ? (
            <Card className="p-10">
              <p className="text-center text-sm text-muted-foreground">Aucun document envoyé pour le moment.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  busy={approveDocMutation.isPending || rejectDocMutation.isPending}
                  onApprove={() => approveDocMutation.mutate(doc.id)}
                  onReject={(reason) => rejectDocMutation.mutate({ docId: doc.id, reason })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Rejeter le dossier chauffeur"
        description="Le chauffeur recevra ce motif et pourra soumettre un nouveau dossier."
      >
        <div className="space-y-3 p-5">
          <textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex : documents illisibles, informations incohérentes…"
            className="w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-danger/25 focus:border-danger"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              disabled={rejectReason.trim().length < 10}
              loading={rejectDriverMutation.isPending}
              onClick={() => {
                rejectDriverMutation.mutate(rejectReason.trim());
                setRejectDialogOpen(false);
              }}
            >
              Confirmer le rejet
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-ink truncate">{value ?? '—'}</span>
    </div>
  );
}
