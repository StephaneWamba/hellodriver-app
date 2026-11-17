export type WhatsAppOutboundMessage =
  | { type: 'text'; body: string; previewUrl?: boolean }
  | {
      type: 'interactive_buttons';
      body: string;
      buttons: Array<{ id: string; title: string }>;
      footer?: string;
    }
  | {
      type: 'interactive_list';
      body: string;
      buttonLabel: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
      header?: string;
      footer?: string;
    }
  | { type: 'location_request'; body: string };

export type SimulatorInput =
  | { type: 'text'; text: string }
  | { type: 'location'; lat: number; lon: number; address?: string }
  | { type: 'menu_selection'; id: string; title: string };

export interface ChatEntry {
  id: string;
  from: 'user' | 'agent';
  message: WhatsAppOutboundMessage;
  ts: number;
}
