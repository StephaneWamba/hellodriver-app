import { config } from '../../core/config.js';

const D7_BASE_URL = 'https://api.d7networks.com/messages/v1/send';
const REQUEST_TIMEOUT_MS = 8000; // Gabon 2G/3G — fail fast rather than hang the OTP request

/**
 * Sends a single SMS via D7 Networks. Throws on any non-accepted response so
 * the caller can decide how to surface the failure — never fails silently.
 */
export async function sendSmsViaD7(phone: string, message: string): Promise<void> {
  if (!config.D7_NETWORKS_API_KEY) {
    throw new Error('D7_NETWORKS_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(D7_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.D7_NETWORKS_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            channel: 'sms',
            recipients: [phone],
            content: message,
            msg_type: 'text',
            data_coding: 'text',
          },
        ],
        message_globals: {
          originator: config.SMS_ORIGINATOR,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`D7 Networks send failed (${res.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
