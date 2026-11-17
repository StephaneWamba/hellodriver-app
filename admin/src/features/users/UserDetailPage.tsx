import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconChevronRight, IconPhone, IconAlertTriangle, IconCar, IconEdit, IconWallet } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { formatDate, formatXaf } from '@/lib/utils';
import { adjustUserWallet, fetchUserDetail, suspendUser, updateUserProfile } from './api';
import type { AdminUserDetail } from './types';

const ROLE_LABEL = { client: 'Client', driver: 'Chauffeur', admin: 'Admin' } as const;

const TRIP_STATUS_LABEL: Record<string, string> = {
  pending_bids: 'En attente de bids',
  bid_accepted: 'Bid accepté',
  driver_en_route: 'Chauffeur en route',
  driver_arrived: 'Chauffeur arrivé',
  in_transit: 'En course',
  completed: 'Terminée',
  rated: 'Notée',
  cancelled_by_client: 'Annulée (client)',
  cancelled_by_driver: 'Annulée (chauffeur)',
  no_bids: 'Aucun bid',
  driver_no_show: 'Chauffeur absent',
  expired: 'Expirée',
  payment_failed: 'Paiement échoué',
};

const TX_REASON_LABEL: Record<string, string> = {
  trip_payment: 'Paiement course',
  trip_earning: 'Gain course',
  commission: 'Commission plateforme',
  deposit: 'Dépôt',
  payout: 'Retrait',
  refund: 'Remboursement',
  referral_reward: 'Récompense parrainage',
  promo_discount: 'Réduction code promo',
  admin_adjustment: 'Ajustement admin',
};

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: !!userId,
  });

  const suspendMutation = useMutation({
    mutationFn: (vars: { suspend: boolean; reason?: string }) => suspendUser(userId!, vars.suspend, vars.reason),
    onSuccess: (_data, vars) => {
      toast.success(vars.suspend ? 'Compte suspendu' : 'Compte réactivé');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuspendDialogOpen(false);
      setReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec de l'opération"),
  });

  if (isLoading) {
    return (
      <AppShell title="Utilisateur">
        <PageSpinner />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Utilisateur introuvable">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Cet utilisateur n'existe pas ou plus.
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${user.firstName} ${user.lastName}`}
      actions={
        user.role !== 'admin' ? (
          user.suspendedAt ? (
            <Button
              variant="outline"
              onClick={() => suspendMutation.mutate({ suspend: false })}
              loading={suspendMutation.isPending}
            >
              Réactiver le compte
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setSuspendDialogOpen(true)}>
              <IconAlertTriangle className="h-4 w-4" /> Suspendre le compte
            </Button>
          )
        ) : undefined
      }
    >
      <div className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/utilisateurs" className="hover:text-ink">Utilisateurs</Link>
        <IconChevronRight className="h-3.5 w-3.5" />
        <span className="text-ink">{user.firstName} {user.lastName}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar
                src={user.avatarUrl}
                firstName={user.firstName}
                lastName={user.lastName}
                size={72}
                tone={user.role === 'driver' ? 'driver' : 'primary'}
              />
              <div>
                <p className="text-base font-semibold text-ink">{user.firstName} {user.lastName}</p>
                <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <IconPhone className="h-3.5 w-3.5" /> {user.phone}
                </p>
                {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={user.role === 'driver' ? 'driver' : user.role === 'admin' ? 'neutral' : 'primary'}>
                  {ROLE_LABEL[user.role]}
                </Badge>
                {user.suspendedAt ? <Badge tone="danger">Suspendu</Badge> : <Badge tone="success">Actif</Badge>}
              </div>
              {user.suspendedAt && user.suspensionReason && (
                <p className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">
                  Motif : {user.suspensionReason}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <IconEdit className="h-3.5 w-3.5" /> Modifier le profil
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hello Monnaie</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setWalletDialogOpen(true)}>
                <IconWallet className="h-3.5 w-3.5" /> Ajuster
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Solde" value={formatXaf(user.walletBalanceXaf)} />
              <Row label="Courses totales" value={String(user.tripCount)} />
              <Row label="Inscrit le" value={formatDate(user.createdAt)} />
            </CardContent>
          </Card>

          {user.driverProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Véhicule</CardTitle>
                <IconCar className="h-4 w-4 text-muted" />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Marque" value={user.driverProfile.vehicleBrand} />
                <Row label="Modèle" value={user.driverProfile.vehicleModel} />
                <Row label="Immatriculation" value={user.driverProfile.vehicleRegistration} />
                <Row
                  label="Note"
                  value={
                    user.driverProfile.ratingCount > 0
                      ? `${Number(user.driverProfile.ratingAvg).toFixed(1)} / 5 (${user.driverProfile.ratingCount})`
                      : 'Aucune course notée'
                  }
                />
                {user.driverVerificationStatus && (
                  <Row
                    label="Vérification"
                    value={
                      user.driverVerificationStatus === 'approved'
                        ? 'Approuvé'
                        : user.driverVerificationStatus === 'rejected'
                          ? 'Rejeté'
                          : 'En attente'
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Courses récentes</CardTitle>
            </CardHeader>
            {user.recentTrips.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune course pour le moment.</p>
            ) : (
              <div className="divide-y divide-border">
                {user.recentTrips.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{TRIP_STATUS_LABEL[t.status] ?? t.status}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                    </div>
                    <p className="font-medium text-ink">
                      {formatXaf(t.finalFareXaf ?? t.fareEstimateXaf ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dernières transactions Hello Monnaie</CardTitle>
            </CardHeader>
            {user.recentTransactions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune transaction pour le moment.</p>
            ) : (
              <div className="divide-y divide-border">
                {user.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{TX_REASON_LABEL[t.reason] ?? t.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                    </div>
                    <p className={t.type === 'credit' ? 'font-medium text-success' : 'font-medium text-danger'}>
                      {t.type === 'credit' ? '+' : '-'}
                      {formatXaf(t.amountXaf)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        title="Suspendre ce compte"
        description="L'utilisateur ne pourra plus se connecter tant que le compte reste suspendu."
      >
        <div className="space-y-3 p-5">
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif de la suspension (visible en interne)…"
            className="w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-danger/25 focus:border-danger"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={suspendMutation.isPending}
              onClick={() => suspendMutation.mutate({ suspend: true, reason: reason.trim() })}
            >
              Confirmer la suspension
            </Button>
          </div>
        </div>
      </Dialog>

      <EditProfileDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} userId={userId!} user={user} />
      <WalletAdjustDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} userId={userId!} />
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

function EditProfileDialog({
  open,
  onOpenChange,
  userId,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  user: AdminUserDetail;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email ?? '');

  const mutation = useMutation({
    mutationFn: () => updateUserProfile(userId, { firstName, lastName, email }),
    onSuccess: () => {
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la mise à jour'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Modifier le profil">
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Dialog>
  );
}

function WalletAdjustDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amountXaf, setAmountXaf] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => adjustUserWallet(userId, { type, amountXaf: Number(amountXaf), reason: reason.trim() }),
    onSuccess: () => {
      toast.success(type === 'credit' ? 'Solde crédité' : 'Solde débité');
      queryClient.invalidateQueries({ queryKey: ['users', userId] });
      onOpenChange(false);
      setAmountXaf('');
      setReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Échec de l'ajustement"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajuster le solde Hello Monnaie"
      description="Un mouvement immédiat et tracé sur le grand livre — jamais une modification directe du solde."
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Opération" value={type} onChange={(e) => setType(e.target.value as 'credit' | 'debit')}>
            <option value="credit">Créditer</option>
            <option value="debit">Débiter</option>
          </Select>
          <Input
            label="Montant (XAF)"
            type="number"
            min={1}
            value={amountXaf}
            onChange={(e) => setAmountXaf(e.target.value)}
            required
          />
        </div>
        <Input
          label="Raison (visible en interne)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex : geste commercial suite à litige"
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="submit"
            variant={type === 'debit' ? 'danger' : 'primary'}
            disabled={!amountXaf || reason.trim().length < 3}
            loading={mutation.isPending}
          >
            Confirmer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
