/**
 * French message template renderer — Tier 1 transactional messages.
 * Variants prevent robotic repetition for frequent interactions.
 */
import type { WhatsAppOutboundMessage } from './agent.types.js';

const GREETINGS = [
  'Bonjour 👋',
  'Salut !',
  'Bonsoir 🌙',
  'Bienvenue sur HelloDriver 🚖',
];

const WAITING_TEXTS = [
  'On cherche un chauffeur... 🔍',
  'Recherche en cours... ⏳',
  'On vous trouve quelqu\'un. Patientez. 🚗',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildMainMenu(walletBalanceXaf?: number): WhatsAppOutboundMessage {
  const greeting = pick(GREETINGS);
  const balance = walletBalanceXaf !== undefined
    ? `\n💰 Solde : *${walletBalanceXaf.toLocaleString()} XAF*`
    : '';

  return {
    type: 'interactive_list',
    header: 'HelloDriver',
    body: `${greeting}${balance}\n\nQue souhaitez-vous faire ?`,
    buttonLabel: 'Voir les options',
    footer: 'HelloDriver · Libreville',
    sections: [{
      rows: [
        { id: 'book',    title: '🚖 Réserver',  description: 'Commander un chauffeur' },
        { id: 'status',  title: '📍 Ma course', description: 'Statut de votre course en cours' },
        { id: 'wallet',  title: '💰 Mon solde', description: 'Voir votre solde HelloDriver' },
        { id: 'support', title: '🆘 Aide',      description: 'Parler à un conseiller' },
      ],
    }],
  };
}

export function buildFareConfirmMessage(
  fareXaf: number,
  originAddr?: string,
  destAddr?: string,
): WhatsAppOutboundMessage {
  const from = originAddr ?? 'Point de départ';
  const to = destAddr ?? 'Destination';
  return {
    type: 'interactive_buttons',
    body: `📊 *Estimation de trajet*\n\n📍 De : ${from}\n🏁 Vers : ${to}\n\n💰 Tarif estimé : *${fareXaf.toLocaleString()} XAF*`,
    buttons: [
      { id: 'confirm', title: 'Confirmer ✅' },
      { id: 'cancel',  title: 'Annuler ❌' },
    ],
    footer: 'Tarif final négocié avec le chauffeur',
  };
}

export function buildWaitingForBidsMessage(): WhatsAppOutboundMessage {
  return {
    type: 'interactive_buttons',
    body: pick(WAITING_TEXTS),
    buttons: [{ id: 'cancel', title: 'Annuler ❌' }],
    footer: 'Les offres arrivent sous ~2 min',
  };
}

export function buildPaymentMethodMenu(
  methods: Array<{ id: string; operator: string; phoneNumber: string }>,
  walletBalanceXaf: number,
): WhatsAppOutboundMessage {
  const rows: Array<{ id: string; title: string; description?: string }> = [
    {
      id: 'wallet',
      title: '💰 Solde HelloDriver',
      description: `${walletBalanceXaf.toLocaleString()} XAF disponibles`,
    },
    ...methods.slice(0, 8).map(m => ({
      id: `pm_${m.id}`,
      title: m.operator === 'airtel_money' ? '📱 Airtel Money' : '📱 Moov Money',
      description: m.phoneNumber,
    })),
    { id: 'cancel', title: '❌ Annuler', description: 'Abandonner la réservation' },
  ];

  return {
    type: 'interactive_list',
    body: 'Choisissez votre mode de paiement :',
    buttonLabel: 'Mode de paiement',
    sections: [{ rows }],
  };
}

export function buildTripStatusMessage(status: string): WhatsAppOutboundMessage {
  const statusLabels: Record<string, string> = {
    pending_bids:    '🔍 Recherche de chauffeur en cours...',
    bid_accepted:    '✅ Chauffeur trouvé !',
    driver_en_route: '🚗 Chauffeur en route vers vous',
    driver_arrived:  '📍 Chauffeur sur place — il vous attend',
    in_transit:      '🛣️ Course en cours',
    completed:       '✅ Course terminée',
    rated:           '✅ Course terminée',
    payment_failed:  '❌ Paiement échoué',
    no_bids:         '😕 Aucun chauffeur disponible pour le moment',
    driver_no_show:  '❌ Le chauffeur ne s\'est pas présenté',
    cancelled_by_client: '❌ Course annulée',
    cancelled_by_driver: '❌ Course annulée par le chauffeur',
    expired:         '⏱️ Recherche expirée, aucun chauffeur n\'a répondu',
  };
  const label = statusLabels[status] ?? `Statut : ${status}`;
  return { type: 'text', body: `*Votre course*\n${label}` };
}

export function buildNoActiveSessionMessage(): WhatsAppOutboundMessage {
  return {
    type: 'text',
    body: 'Bienvenue sur HelloDriver ! Créez un compte sur notre application pour commencer. 📱',
  };
}
