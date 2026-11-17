import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconSearch, IconUsers, IconChevronRight } from '@/components/ui/icons';
import { cn, formatDate, formatXaf } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';
import { fetchUsers } from './api';
import type { UserRole } from './types';

const ROLE_FILTERS: { value: UserRole | undefined; label: string }[] = [
  { value: undefined, label: 'Tous' },
  { value: 'client', label: 'Clients' },
  { value: 'driver', label: 'Chauffeurs' },
  { value: 'admin', label: 'Admins' },
];

const ROLE_BADGE_TONE = {
  client: 'primary',
  driver: 'driver',
  admin: 'neutral',
} as const;

const ROLE_LABEL = {
  client: 'Client',
  driver: 'Chauffeur',
  admin: 'Admin',
} as const;

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['users', debouncedSearch, role, page],
    queryFn: () => fetchUsers({ search: debouncedSearch || undefined, role, page }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell title="Utilisateurs" description="Recherche, profils et modération des comptes">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Nom, téléphone ou email…"
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-surface-sunken p-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => {
                setRole(f.value);
                setPage(1);
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                role === f.value ? 'bg-white text-ink shadow-card' : 'text-muted-foreground hover:text-ink'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading && !data ? (
          <PageSpinner />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title="Aucun utilisateur trouvé"
            description="Essaie une autre recherche ou change le filtre de rôle."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Utilisateur</th>
                    <th className="px-5 py-3 font-medium">Rôle</th>
                    <th className="px-5 py-3 font-medium">Téléphone</th>
                    <th className="px-5 py-3 font-medium">Solde Hello Monnaie</th>
                    <th className="px-5 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 font-medium">Inscrit le</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                      <td className="px-5 py-3">
                        <Link to={`/utilisateurs/${u.id}`} className="flex items-center gap-3">
                          <Avatar
                            src={u.avatarUrl}
                            firstName={u.firstName}
                            lastName={u.lastName}
                            size={36}
                            tone={u.role === 'driver' ? 'driver' : 'primary'}
                          />
                          <span className="font-medium text-ink">
                            {u.firstName} {u.lastName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ROLE_BADGE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                        {u.role === 'driver' && u.driverVerificationStatus === 'pending' && (
                          <Badge tone="warning" className="ml-1.5">En attente</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.phone}</td>
                      <td className="px-5 py-3 font-medium text-ink">{formatXaf(u.walletBalanceXaf)}</td>
                      <td className="px-5 py-3">
                        {u.suspendedAt ? (
                          <Badge tone="danger">Suspendu</Badge>
                        ) : (
                          <Badge tone="success">Actif</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3">
                        <Link to={`/utilisateurs/${u.id}`}>
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
                {data.total} utilisateur{data.total > 1 ? 's' : ''} · page {data.page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
