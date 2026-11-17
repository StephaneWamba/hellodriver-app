import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconGift, IconUsers, IconClock, IconEdit } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { formatDate, formatXaf } from '@/lib/utils';
import {
  createPromoCode,
  deactivatePromoCode,
  deletePromoCode,
  fetchPromoCodes,
  fetchReferralsOverview,
  updatePromoCode,
} from './api';
import type { AdminPromoCode } from './types';

export function PromosPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<AdminPromoCode | null>(null);
  const [deletingCode, setDeletingCode] = useState<AdminPromoCode | null>(null);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['referrals', 'overview'],
    queryFn: fetchReferralsOverview,
  });

  const { data: codes, isLoading: codesLoading } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: fetchPromoCodes,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivatePromoCode,
    onSuccess: () => {
      toast.success('Code désactivé');
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la désactivation'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePromoCode,
    onSuccess: () => {
      toast.success('Code promo supprimé');
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      setDeletingCode(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la suppression'),
  });

  return (
    <AppShell title="Parrainage & promos" description="Programme de parrainage et codes promotionnels">
      {overviewLoading || !overview ? (
        <PageSpinner />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<IconUsers className="h-5 w-5" />} tone="primary" label="Parrainages au total" value={String(overview.totalReferrals)} />
          <StatCard icon={<IconGift className="h-5 w-5" />} tone="success" label="Récompenses versées" value={formatXaf(overview.totalRewardsXaf)} />
          <StatCard icon={<IconClock className="h-5 w-5" />} tone="warning" label="30 derniers jours" value={String(overview.referralsLast30Days)} />
        </div>
      )}

      {overview && overview.topReferrers.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader><CardTitle>Meilleurs parrains</CardTitle></CardHeader>
          <div className="divide-y divide-border">
            {overview.topReferrers.map((r, i) => (
              <div key={r.userId} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{r.firstName} {r.lastName}</p>
                    <p className="text-xs text-muted-foreground">{r.phone}</p>
                  </div>
                </div>
                <Badge tone="primary">{r.referralCount} parrainage{r.referralCount > 1 ? 's' : ''}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-ink">Codes promo</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>Créer un code</Button>
        </div>

        {codesLoading ? (
          <PageSpinner />
        ) : !codes || codes.data.length === 0 ? (
          <EmptyState icon={<IconGift />} title="Aucun code promo" description="Crée le premier code promotionnel de la plateforme." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Valeur</th>
                  <th className="px-5 py-3 font-medium">Utilisations</th>
                  <th className="px-5 py-3 font-medium">Expiration</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {codes.data.map((c) => {
                  const expired = c.expiresAt && new Date(c.expiresAt) <= new Date();
                  const exhausted = c.maxUses != null && c.usesCount >= c.maxUses;
                  const inactive = expired || exhausted;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-5 py-3 font-mono font-medium text-ink">{c.code}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {c.type === 'fixed_xaf' ? formatXaf(c.value) : `${c.value}%`}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {c.usesCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {c.expiresAt ? formatDate(c.expiresAt) : 'Jamais'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={inactive ? 'neutral' : 'success'}>{inactive ? 'Inactif' : 'Actif'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingCode(c)}>
                            <IconEdit className="h-3.5 w-3.5" />
                          </Button>
                          {!inactive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={deactivateMutation.isPending && deactivateMutation.variables === c.id}
                              onClick={() => deactivateMutation.mutate(c.id)}
                            >
                              Désactiver
                            </Button>
                          )}
                          {c.usesCount === 0 && (
                            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeletingCode(c)}>
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreatePromoDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditPromoDialog key={editingCode?.id ?? 'none'} code={editingCode} onOpenChange={(open) => !open && setEditingCode(null)} />

      <Dialog
        open={!!deletingCode}
        onOpenChange={(open) => !open && setDeletingCode(null)}
        title="Supprimer ce code promo"
        description={deletingCode ? `Le code ${deletingCode.code} sera définitivement supprimé.` : undefined}
      >
        <div className="flex justify-end gap-2 p-5">
          <Button variant="ghost" onClick={() => setDeletingCode(null)}>Annuler</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deletingCode && deleteMutation.mutate(deletingCode.id)}
          >
            Supprimer définitivement
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: 'primary' | 'success' | 'warning'; label: string; value: string }) {
  const toneClasses = {
    primary: 'bg-primary-light text-primary-dark',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
  } as const;
  return (
    <Card className="p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div>
      <p className="font-display text-xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}

function CreatePromoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'fixed_xaf' | 'percentage'>('fixed_xaf');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createPromoCode({
        code,
        type,
        value: Number(value),
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success('Code promo créé');
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      onOpenChange(false);
      setCode('');
      setValue('');
      setMaxUses('');
      setExpiresAt('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la création'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Créer un code promo" description="Le code sera utilisable immédiatement par les clients.">
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <Input
          label="Code"
          placeholder="BIENVENUE10"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as 'fixed_xaf' | 'percentage')}>
            <option value="fixed_xaf">Montant fixe (XAF)</option>
            <option value="percentage">Pourcentage (%)</option>
          </Select>
          <Input
            label={type === 'fixed_xaf' ? 'Montant (XAF)' : 'Pourcentage'}
            type="number"
            min={1}
            max={type === 'percentage' ? 100 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Utilisations max (optionnel)"
            type="number"
            min={1}
            placeholder="Illimité"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
          <Input
            label="Expiration (optionnel)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending}>Créer le code</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditPromoDialog({
  code,
  onOpenChange,
}: {
  code: AdminPromoCode | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(code ? String(code.value) : '');
  const [maxUses, setMaxUses] = useState(code?.maxUses != null ? String(code.maxUses) : '');
  const [expiresAt, setExpiresAt] = useState(code?.expiresAt ? code.expiresAt.slice(0, 10) : '');

  const mutation = useMutation({
    mutationFn: () =>
      updatePromoCode(code!.id, {
        value: Number(value),
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success('Code promo mis à jour');
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la mise à jour'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (!code) return null;

  return (
    <Dialog open onOpenChange={onOpenChange} title={`Modifier ${code.code}`}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <Input
          label={code.type === 'fixed_xaf' ? 'Montant (XAF)' : 'Pourcentage'}
          type="number"
          min={1}
          max={code.type === 'percentage' ? 100 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Utilisations max"
            type="number"
            min={1}
            placeholder="Illimité"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
          <Input label="Expiration" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Dialog>
  );
}
