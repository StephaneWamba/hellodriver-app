import type { SimulatorInput, WhatsAppOutboundMessage } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const SIM_KEY = import.meta.env.VITE_SIMULATOR_KEY;

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Simulator-Key': SIM_KEY,
  };
}

export async function sendMessage(
  phone: string,
  input: SimulatorInput,
): Promise<{ messages: WhatsAppOutboundMessage[] }> {
  const res = await fetch(`${API_BASE}/agent/simulate/send`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ phone, input }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Erreur ${res.status}`);
  }
  return res.json();
}

export async function pollMessages(phone: string): Promise<{ messages: WhatsAppOutboundMessage[] }> {
  const res = await fetch(`${API_BASE}/agent/simulate/${encodeURIComponent(phone)}/poll`, {
    headers: headers(),
  });
  if (!res.ok) return { messages: [] };
  return res.json();
}

export async function resetSession(phone: string): Promise<void> {
  // No body on this call — omit Content-Type, Fastify's default JSON parser
  // rejects an empty body when that header is set.
  await fetch(`${API_BASE}/agent/simulate/${encodeURIComponent(phone)}/reset`, {
    method: 'POST',
    headers: { 'X-Simulator-Key': SIM_KEY },
  });
}
