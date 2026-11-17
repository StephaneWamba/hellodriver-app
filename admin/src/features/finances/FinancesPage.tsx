import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { IconWallet, IconAlertTriangle, IconClock, IconDownload, IconGift } from '@/components/ui/icons';
import { cn, formatDate, formatXaf } from '@/lib/utils';
import { fetchFinancesOverview, fetchPayments, fetchTransactions } from './api';

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

const PAYMENT_STATUS_TONE = { pending: 'warning', completed: 'success', failed: 'danger' } as const;
const PAYMENT_STATUS_LABEL = { pending: 'En attente', completed: 'Complété', failed: 'Échoué' } as const;
const PAYMENT_TYPE_LABEL = { deposit: 'Dépôt', payout: 'Retrait', refund: 'Remboursement' } as const;

export function FinancesPage() {
  const [tab, setTab] = useState<'transactions' | 'payments'>('transactions');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['finances', 'overview'],
    queryFn: fetchFinancesOverview,
    refetchInterval: 60_000,
  });

  return (
    <AppShell title="Finances" description="Revenu plateforme, dépôts, retraits et grand livre">
      {overviewLoading || !overview ? (
        <PageSpinner />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<IconWallet className="h-5 w-5" />}
            tone="primary"
            label="Commission plateforme (total)"
            value={formatXaf(overview.totalCommissionXaf)}
            sub={`+${formatXaf(overview.todayCommissionXaf)} aujourd'hui`}
          />
          <StatCard
            icon={<IconGift className="h-5 w-5" />}
            tone="driver"
            label="Solde total Hello Monnaie"
            value={formatXaf(overview.totalWalletBalanceXaf)}
            sub="Tous les utilisateurs"
          />
          <StatCard
            icon={<IconDownload className="h-5 w-5" />}
            tone="success"
            label="Dépôts aujourd'hui"
            value={formatXaf(overview.todayDepositsXaf)}
            sub={`${formatXaf(overview.totalDepositsXaf)} au total`}
          />
          <StatCard
            icon={<IconClock className="h-5 w-5" />}
            tone={overview.pendingPayoutsCount > 0 ? 'warning' : 'success'}
            label="Retraits en attente"
            value={String(overview.pendingPayoutsCount)}
            sub={`${formatXaf(overview.todayPayoutsXaf)} versés aujourd'hui`}
          />
          {overview.failedPayments24hCount > 0 && (
            <div className="sm:col-span-2 xl:col-span-4">
              <Card className="flex items-center gap-3 border-danger/30 bg-danger-light px-5 py-3.5">
                <IconAlertTriangle className="h-5 w-5 shrink-0 text-danger" />
                <p className="text-sm text-danger">
                  {overview.failedPayments24hCount} paiement{overview.failedPayments24hCount > 1 ? 's' : ''} en échec
                  sur les dernières 24h — vérifie l'onglet Paiements ci-dessous.
                </p>
              </Card>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center gap-1 rounded-xl bg-surface-sunken p-1 w-fit">
        <button
          onClick={() => setTab('transactions')}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            tab === 'transactions' ? 'bg-white text-ink shadow-card' : 'text-muted-foreground hover:text-ink'
          )}
        >
          Transactions
        </button>
        <button
          onClick={() => setTab('payments')}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            tab === 'payments' ? 'bg-white text-ink shadow-card' : 'text-muted-foreground hover:text-ink'
          )}
        >
          Paiements pawaPay
        </button>
      </div>

      {tab === 'transactions' ? <TransactionsTable /> : <PaymentsTable />}
    </AppShell>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  tone: 'primary' | 'driver' | 'success' | 'warning';
  label: string;
  value: string;
  sub: string;
}) {
  const toneClasses = {
    primary: 'bg-primary-light text-primary-dark',
    driver: 'bg-driver-light text-driver-dark',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
  } as const;

  return (
    <Card className="p-5">
      <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl', toneClasses[tone])}>
        {icon}
      </div>
      <p className="font-display text-xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </Card>
  );
}

function TransactionsTable() {
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['finances', 'transactions', reason, page],
    queryFn: () => fetchTransactions({ reason: reason || undefined, page }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-sm font-semibold text-ink">Grand livre Hello Monnaie</p>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && <Spinner size={16} />}
          <Select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setPage(1);
            }}
            className="h-9 w-56"
          >
            <option value="">Tous les motifs</option>
            {Object.entries(TX_REASON_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && !data ? (
        <PageSpinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={<IconWallet />} title="Aucune transaction" description="Aucun mouvement ne correspond à ce filtre." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Utilisateur</th>
                  <th className="px-5 py-3 font-medium">Motif</th>
                  <th className="px-5 py-3 font-medium">Montant</th>
                  <th className="px-5 py-3 font-medium">Solde après</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{t.userFirstName} {t.userLastName}</p>
                      <p className="text-xs text-muted-foreground">{t.userPhone}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{TX_REASON_LABEL[t.reason] ?? t.reason}</td>
                    <td className={cn('px-5 py-3 font-medium', t.type === 'credit' ? 'text-success' : 'text-danger')}>
                      {t.type === 'credit' ? '+' : '-'}{formatXaf(t.amountXaf)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatXaf(t.balanceAfterXaf)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={data.total} page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function PaymentsTable() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['finances', 'payments', status, type, page],
    queryFn: () => fetchPayments({ status: status || undefined, type: type || undefined, page }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-sm font-semibold text-ink">Dépôts et retraits pawaPay</p>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && <Spinner size={16} />}
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 w-40">
            <option value="">Tous types</option>
            <option value="deposit">Dépôt</option>
            <option value="payout">Retrait</option>
            <option value="refund">Remboursement</option>
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-40">
            <option value="">Tous statuts</option>
            <option value="pending">En attente</option>
            <option value="completed">Complété</option>
            <option value="failed">Échoué</option>
          </Select>
        </div>
      </div>

      {isLoading && !data ? (
        <PageSpinner />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={<IconWallet />} title="Aucun paiement" description="Aucun paiement ne correspond à ce filtre." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Utilisateur</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Opérateur</th>
                  <th className="px-5 py-3 font-medium">Montant</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{p.userFirstName} {p.userLastName}</p>
                      <p className="text-xs text-muted-foreground">{p.userPhone}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{PAYMENT_TYPE_LABEL[p.type]}</td>
                    <td className="px-5 py-3 text-muted-foreground capitalize">{p.operator.replace('_', ' ')}</td>
                    <td className="px-5 py-3 font-medium text-ink">{formatXaf(p.amountXaf)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                      {p.status === 'failed' && p.failureReason && (
                        <p className="mt-1 text-xs text-danger">{p.failureReason}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={data.total} page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function Pagination({
  total,
  page,
  totalPages,
  onChange,
}: {
  total: number;
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">
        {total} résultat{total > 1 ? 's' : ''} · page {page}/{totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Suivant</Button>
      </div>
    </div>
  );
}
