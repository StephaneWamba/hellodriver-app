export type ConversationState =
  | 'idle'
  | 'booking_origin'
  | 'booking_destination'
  | 'showing_fare'
  | 'awaiting_payment'
  | 'waiting_bids'
  | 'showing_bid'
  | 'active_trip'
  | 'support';

export interface AdminAgentStatus {
  circuitBreaker: { open: boolean; failures: number };
  activeSessions: Array<{
    phone: string;
    fsm: ConversationState;
    lastActivityAt: number;
    userId: string;
    userFirstName: string | null;
    userLastName: string | null;
  }>;
}
