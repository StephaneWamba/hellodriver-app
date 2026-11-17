import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { IconChat, IconAlertTriangle, IconCheck } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/utils';
import { fetchAgentStatus } from './api';
import type { ConversationState } from './types';

const FSM_LABEL: Record<ConversationState, string> = {
  idle: 'Inactif',
  booking_origin: 'Saisie du départ',
  booking_destination: "Saisie de l'arrivée",
  showing_fare: 'Consultation du tarif',
  awaiting_payment: 'En attente de paiement',
  waiting_bids: 'En attente de bids',
  showing_bid: "Consultation d'un bid",
  active_trip: 'Course en cours',
  support: 'Support',
};

export function AgentPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['agent', 'status'],
    queryFn: fetchAgentStatus,
    refetchInterval: 15_000,
  });

  return (
    <AppShell
      title="Agent WhatsApp"
      description="Statut de l'agent IA et conversations en cours"
      actions={isFetching && !isLoading ? <Spinner size={16} /> : undefined}
    >
      {isLoading || !data ? (
        <PageSpinner />
      ) : (
        <>
          <Card className={`mb-6 flex items-center gap-3 px-5 py-4 ${data.circuitBreaker.open ? 'border-danger/30 bg-danger-light' : 'border-success/30 bg-success-light'}`}>
            {data.circuitBreaker.open ? (
              <IconAlertTriangle className="h-5 w-5 shrink-0 text-danger" />
            ) : (
              <IconCheck className="h-5 w-5 shrink-0 text-success" />
            )}
            <div>
              <p className={`text-sm font-semibold ${data.circuitBreaker.open ? 'text-danger' : 'text-success'}`}>
                {data.circuitBreaker.open ? 'Circuit ouvert — LLM temporairement désactivé' : 'Agent opérationnel'}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.circuitBreaker.failures} échec{data.circuitBreaker.failures > 1 ? 's' : ''} consécutif
                {data.circuitBreaker.failures > 1 ? 's' : ''}
                {data.circuitBreaker.open && ' — réponses de repli envoyées en attendant la réinitialisation automatique'}
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Conversations actives ({data.activeSessions.length})</CardTitle>
            </CardHeader>
            {data.activeSessions.length === 0 ? (
              <EmptyState icon={<IconChat />} title="Aucune conversation en cours" description="Les échanges WhatsApp actifs apparaîtront ici." />
            ) : (
              <div className="divide-y divide-border">
                {data.activeSessions.map((s) => (
                  <Link
                    key={s.phone}
                    to={`/utilisateurs/${s.userId}`}
                    className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-surface-sunken/60"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {s.userFirstName ? `${s.userFirstName} ${s.userLastName}` : s.phone}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.fsm === 'active_trip' ? 'primary' : s.fsm === 'idle' ? 'neutral' : 'warning'}>
                        {FSM_LABEL[s.fsm] ?? s.fsm}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(new Date(s.lastActivityAt))}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}
