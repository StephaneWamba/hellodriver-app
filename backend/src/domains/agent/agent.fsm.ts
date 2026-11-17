/**
 * Pure FSM transition function — no I/O, no async, fully unit-testable.
 * Input: current session + event → Output: new session + list of actions to execute.
 */
import type {
  SessionData,
  FsmInput,
  FsmResult,
  FsmAction,
  WhatsAppOutboundMessage,
} from './agent.types.js';

// Helper: create a send_message action
function msg(
  message: WhatsAppOutboundMessage,
  tier: 'transactional' | 'conversational' = 'transactional',
): FsmAction {
  return { type: 'send_message', message, tier };
}

// Parses the `addr_<index>_<lat>_<lon>` id built in agent.worker.ts's
// disambiguate_address handler when it shows a multi-candidate address list.
function parseAddrSelection(id: string): { lat: number; lon: number } | null {
  const match = id.match(/^addr_\d+_(-?\d+\.\d+)_(-?\d+\.\d+)$/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

export function transition(session: SessionData, input: FsmInput): FsmResult {
  const s = session.fsm;
  const actions: FsmAction[] = [];
  const newSession: SessionData = { ...session, lastActivityAt: Date.now() };

  // ── idle ──────────────────────────────────────────────────────────────────
  if (s === 'idle') {
    if (input.type === 'user_text') {
      // Free text → LLM classifies intent; worker re-enters FSM after resolution
      actions.push({ type: 'classify_intent' });
      return { newSession, actions };
    }
    if (input.type === 'user_menu_selection') {
      if (input.id === 'book') {
        newSession.fsm = 'booking_origin';
        actions.push(msg({ type: 'location_request', body: 'Partagez votre position de départ ou tapez l\'adresse. 📍' }));
      } else if (input.id === 'status') {
        actions.push({ type: 'call_get_trip_status' });
      } else if (input.id === 'wallet') {
        actions.push({ type: 'call_get_wallet_balance' });
      } else if (input.id === 'support') {
        newSession.fsm = 'support';
        actions.push(msg({ type: 'text', body: 'Comment puis-je vous aider ?' }, 'conversational'));
      }
    }
    if (input.type === 'trip_event') {
      return handleTripEvent(newSession, input, actions);
    }
  }

  // ── booking_origin ────────────────────────────────────────────────────────
  else if (s === 'booking_origin') {
    if (input.type === 'user_location') {
      newSession.context = {
        ...newSession.context,
        origin: { lat: input.lat, lon: input.lon, address: input.address },
      };
      newSession.fsm = 'booking_destination';
      actions.push(msg({ type: 'location_request', body: 'Maintenant partagez votre destination. 🏁' }));
    } else if (input.type === 'user_text') {
      actions.push({ type: 'disambiguate_address', text: input.text });
    } else if (input.type === 'user_menu_selection' && input.id === 'cancel') {
      newSession.fsm = 'idle';
      newSession.context = {};
      actions.push(msg({ type: 'text', body: 'Réservation annulée. À bientôt ! 👋' }));
    } else if (input.type === 'user_menu_selection') {
      const loc = parseAddrSelection(input.id);
      if (loc) {
        newSession.context = {
          ...newSession.context,
          origin: { lat: loc.lat, lon: loc.lon, address: input.title },
        };
        newSession.fsm = 'booking_destination';
        actions.push(msg({ type: 'location_request', body: 'Maintenant partagez votre destination. 🏁' }));
      }
    }
  }

  // ── booking_destination ───────────────────────────────────────────────────
  else if (s === 'booking_destination') {
    if (input.type === 'user_location') {
      newSession.context = {
        ...newSession.context,
        destination: { lat: input.lat, lon: input.lon, address: input.address },
      };
      newSession.fsm = 'showing_fare';
      actions.push({ type: 'call_get_fare_estimate' });
    } else if (input.type === 'user_text') {
      actions.push({ type: 'disambiguate_address', text: input.text });
    } else if (input.type === 'user_menu_selection' && input.id === 'cancel') {
      newSession.fsm = 'idle';
      newSession.context = {};
      actions.push(msg({ type: 'text', body: 'Réservation annulée. À bientôt ! 👋' }));
    } else if (input.type === 'user_menu_selection') {
      const loc = parseAddrSelection(input.id);
      if (loc) {
        newSession.context = {
          ...newSession.context,
          destination: { lat: loc.lat, lon: loc.lon, address: input.title },
        };
        newSession.fsm = 'showing_fare';
        actions.push({ type: 'call_get_fare_estimate' });
      }
    }
  }

  // ── showing_fare ──────────────────────────────────────────────────────────
  else if (s === 'showing_fare') {
    if (input.type === 'user_menu_selection') {
      if (input.id === 'confirm') {
        newSession.fsm = 'awaiting_payment';
        actions.push({ type: 'call_list_payment_methods' });
      } else if (input.id === 'cancel') {
        newSession.fsm = 'idle';
        newSession.context = {};
        actions.push(msg({ type: 'text', body: 'D\'accord, on annule. À bientôt ! 👋' }));
      }
    }
  }

  // ── awaiting_payment ──────────────────────────────────────────────────────
  else if (s === 'awaiting_payment') {
    if (input.type === 'user_menu_selection') {
      if (input.id === 'wallet') {
        newSession.context = { ...newSession.context, activePaymentMethodId: undefined };
        newSession.fsm = 'waiting_bids';
        actions.push({ type: 'call_book_trip' });
      } else if (input.id.startsWith('pm_')) {
        newSession.context = {
          ...newSession.context,
          activePaymentMethodId: input.id.replace('pm_', ''),
        };
        newSession.fsm = 'waiting_bids';
        actions.push({ type: 'call_book_trip' });
      } else if (input.id === 'cancel') {
        newSession.fsm = 'idle';
        newSession.context = {};
        actions.push(msg({ type: 'text', body: 'Réservation annulée. À bientôt ! 👋' }));
      }
    }
  }

  // ── waiting_bids ──────────────────────────────────────────────────────────
  else if (s === 'waiting_bids') {
    if (input.type === 'trip_event' && input.eventType === 'bid_received') {
      return handleTripEvent({ ...newSession, fsm: 'showing_bid' }, input, actions);
    } else if (input.type === 'user_menu_selection' && input.id === 'cancel') {
      newSession.fsm = 'idle';
      newSession.context = {};
      actions.push({ type: 'call_cancel_trip' });
    } else if (input.type === 'user_text') {
      actions.push(msg(
        { type: 'text', body: 'On cherche un chauffeur pour vous... 🔍 Patientez svp.' },
        'conversational',
      ));
    }
  }

  // ── showing_bid ───────────────────────────────────────────────────────────
  else if (s === 'showing_bid') {
    if (input.type === 'user_menu_selection') {
      if (input.id === 'accept') {
        const bid = newSession.context.pendingBids?.[0];
        if (bid) {
          newSession.fsm = 'active_trip';
          actions.push({ type: 'call_accept_bid', bidId: bid.bidId });
        } else {
          // Offre expirée/déjà traitée entre-temps — ne pas laisser
          // l'utilisateur sans réponse.
          newSession.fsm = 'waiting_bids';
          actions.push(msg(
            { type: 'text', body: 'Cette offre n\'est plus disponible. On continue la recherche... 🔍' },
            'conversational',
          ));
        }
      } else if (input.id === 'decline') {
        newSession.fsm = 'waiting_bids';
        newSession.context = {
          ...newSession.context,
          pendingBids: newSession.context.pendingBids?.slice(1),
        };
        actions.push(msg(
          { type: 'text', body: 'Offre refusée. On cherche un autre chauffeur... 🔍' },
          'conversational',
        ));
      }
    } else if (input.type === 'trip_event' && input.eventType === 'bid_received') {
      return handleTripEvent(newSession, input, actions);
    }
  }

  // ── active_trip ───────────────────────────────────────────────────────────
  else if (s === 'active_trip') {
    if (input.type === 'trip_event') {
      return handleTripEvent(newSession, input, actions);
    } else if (input.type === 'user_text') {
      actions.push({ type: 'generate_conversational_reply', context: 'active_trip' });
    } else if (input.type === 'user_menu_selection' && input.id === 'cancel') {
      newSession.fsm = 'idle';
      newSession.context = {};
      actions.push({ type: 'call_cancel_trip' });
    }
  }

  // ── support ───────────────────────────────────────────────────────────────
  else if (s === 'support') {
    if (input.type === 'user_text') {
      actions.push({ type: 'generate_support_response' });
    } else if (input.type === 'user_menu_selection' && input.id === 'exit_support') {
      newSession.fsm = 'idle';
      actions.push(msg({ type: 'text', body: 'D\'accord ! Tapez "menu" pour revenir à l\'accueil. 🏠' }));
    }
  }

  return { newSession, actions };
}

// ── Trip event handler (shared across states) ─────────────────────────────────
function handleTripEvent(
  session: SessionData,
  input: Extract<FsmInput, { type: 'trip_event' }>,
  actions: FsmAction[],
): FsmResult {
  const newSession = { ...session };

  switch (input.eventType) {
    case 'bid_received': {
      const bid = input.payload as {
        bidId: string;
        driverName: string;
        amountXaf: number;
        etaMin: number;
      };
      newSession.context = {
        ...newSession.context,
        pendingBids: [bid, ...(newSession.context.pendingBids ?? [])],
      };
      newSession.fsm = 'showing_bid';
      actions.push(msg({
        type: 'interactive_buttons',
        body: `🚖 Offre reçue !\n\n*Chauffeur :* ${bid.driverName}\n*Tarif :* ${bid.amountXaf.toLocaleString()} XAF\n*Arrivée :* ~${bid.etaMin} min`,
        buttons: [
          { id: 'accept', title: 'Accepter ✅' },
          { id: 'decline', title: 'Refuser ❌' },
        ],
      }));
      break;
    }
    case 'driver_en_route':
      actions.push(msg({ type: 'text', body: '🚗 Votre chauffeur est en route ! Préparez-vous.' }));
      break;
    case 'driver_arrived':
      actions.push(msg({ type: 'text', body: '📍 Votre chauffeur est arrivé ! Il vous attend.' }));
      break;
    case 'in_transit':
      actions.push(msg({ type: 'text', body: '🛣️ Vous êtes en route. Bon voyage !' }));
      break;
    case 'completed':
      newSession.fsm = 'idle';
      newSession.context = {};
      actions.push(msg(
        { type: 'text', body: '✅ Course terminée ! Merci d\'avoir utilisé HelloDriver. 🙏' },
        'conversational',
      ));
      break;
    case 'payment_confirmed':
      actions.push(msg({ type: 'text', body: '💳 Paiement confirmé. Merci !' }));
      break;
    case 'payment_failed':
      actions.push(msg({ type: 'text', body: '❌ Paiement échoué. Réessayez ou contactez le support.' }));
      break;
  }

  return { newSession, actions };
}
