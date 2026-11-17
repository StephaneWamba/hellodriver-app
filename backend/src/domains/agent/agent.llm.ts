/**
 * Vercel AI SDK v6 wrapper with circuit breaker.
 * Provider-agnostic: swap LLM_FAST_MODEL env var to switch providers with zero code change.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createProviderRegistry, generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { config } from '../../core/config.js';
import type { IntentResult, IntentType, SessionData } from './agent.types.js';

// ── Provider registry (singleton) ────────────────────────────────────────────
const registry = createProviderRegistry({
  anthropic,
  openai: createOpenAI({ apiKey: config.OPENAI_API_KEY }),
});

const fastModel = () =>
  registry.languageModel(config.LLM_FAST_MODEL as `${'anthropic' | 'openai'}:${string}`);

// ── Circuit breaker ───────────────────────────────────────────────────────────
let consecutiveFailures = 0;
let circuitOpenAt = 0;

function isCircuitOpen(): boolean {
  if (consecutiveFailures < config.AGENT_CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() - circuitOpenAt > config.AGENT_CIRCUIT_BREAKER_RESET_MS) {
    consecutiveFailures = 0;
    return false;
  }
  return true;
}

function onLlmSuccess(): void { consecutiveFailures = 0; }
function onLlmFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= config.AGENT_CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenAt = Date.now();
    console.warn('[agent.llm] Circuit breaker OPEN — LLM calls disabled for 60s');
  }
}

// ── Persona system prompt ─────────────────────────────────────────────────────
const PERSONA = `Tu es l'agent HelloDriver à Libreville, Gabon. Tu parles comme quelqu'un de Libreville — chaleureux, direct, professionnel.
Tu connais la ville : PK8, Akanda, Nkembo, Alibandeng, Batterie IV, Lalala, Charbonnages, Louis.
Français naturel. Phrases courtes. Jamais plus de 3 lignes par message. Ne mentionne jamais de concurrents.`;

// ── Intent classification ─────────────────────────────────────────────────────
// Claude's structured-output schema doesn't support `minimum`/`maximum` on
// numbers (same limitation as `maxItems` on arrays, see disambiguateAddress
// below) — keep confidence unconstrained, callers already treat it loosely.
const intentSchema = z.object({
  intent: z.enum(['book_trip', 'check_status', 'cancel_trip', 'wallet', 'support', 'unknown']),
  confidence: z.number(),
});

export async function classifyIntent(text: string): Promise<IntentResult> {
  if (isCircuitOpen()) return { intent: 'support', confidence: 0 };

  try {
    const { output } = await generateText({
      model: fastModel(),
      system: `${PERSONA}\n\nClassifie l'intention de l'utilisateur parmi : book_trip (réserver une course), check_status (état de la course), cancel_trip (annuler), wallet (solde/argent), support (aide/problème), unknown.`,
      prompt: text,
      output: Output.object({ schema: intentSchema }),
      maxOutputTokens: 60,
      temperature: 0,
      timeout: config.AGENT_LLM_FAST_TIMEOUT_MS,
    });
    onLlmSuccess();
    return { intent: output.intent as IntentType, confidence: output.confidence };
  } catch (err) {
    onLlmFailure();
    if (NoObjectGeneratedError.isInstance(err)) {
      return { intent: 'support', confidence: 0 };
    }
    console.error('[agent.llm] classifyIntent error', (err as Error).message);
    return { intent: 'support', confidence: 0 };
  }
}

// ── Support response ──────────────────────────────────────────────────────────
export async function generateSupportResponse(
  userText: string,
  history: SessionData['messageHistory'],
): Promise<string> {
  if (isCircuitOpen()) {
    return 'Je vous mets en relation avec notre équipe. Un instant... 🙏';
  }

  const messages = [
    ...history.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' as const : 'assistant' as const,
      content: h.text,
    })),
    { role: 'user' as const, content: userText },
  ];

  try {
    const { text } = await generateText({
      model: fastModel(),
      system: `${PERSONA}\n\nTu es en mode support. Aide l'utilisateur avec ses problèmes (paiement, course, compte). Sois empathique et concis.`,
      messages,
      maxOutputTokens: 200,
      temperature: 0.7,
      timeout: config.AGENT_LLM_QUALITY_TIMEOUT_MS,
    });
    onLlmSuccess();
    return text;
  } catch (err) {
    onLlmFailure();
    console.error('[agent.llm] generateSupportResponse error', (err as Error).message);
    return 'Je suis désolé, je ne peux pas répondre pour le moment. Réessayez dans un instant. 🙏';
  }
}

// ── Conversational reply (during active trip or free-form) ────────────────────
export async function generateConversationalReply(
  userText: string,
  context: string,
  history: SessionData['messageHistory'],
): Promise<string> {
  if (isCircuitOpen()) return 'Je vous entends. Un instant... ⏳';

  try {
    const { text } = await generateText({
      model: fastModel(),
      system: `${PERSONA}\n\nContexte actuel : ${context}. Réponds de façon naturelle et courte.`,
      messages: [
        ...history.slice(-4).map(h => ({
          role: h.role === 'user' ? 'user' as const : 'assistant' as const,
          content: h.text,
        })),
        { role: 'user' as const, content: userText },
      ],
      maxOutputTokens: 100,
      temperature: 0.8,
      timeout: config.AGENT_LLM_FAST_TIMEOUT_MS,
    });
    onLlmSuccess();
    return text;
  } catch (err) {
    onLlmFailure();
    return 'Je vous entends. Un instant... ⏳';
  }
}

// ── Address disambiguation ────────────────────────────────────────────────────
const addressSchema = z.object({
  // Claude's structured-output schema doesn't support `maxItems` on arrays —
  // cap the result by slicing in code instead (see disambiguateAddress below).
  candidates: z.array(z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number(),
    confidence: z.number(),
  })),
});

export async function disambiguateAddress(
  text: string,
): Promise<Array<{ label: string; lat: number; lon: number }>> {
  if (isCircuitOpen()) return [];

  try {
    const { output } = await generateText({
      model: fastModel(),
      system: `${PERSONA}\n\nL'utilisateur donne une adresse à Libreville. Propose jusqu'à 3 endroits correspondants avec coordonnées GPS réalistes. Libreville centre : 0.3924°N, 9.4536°E.`,
      prompt: `Adresse : "${text}"`,
      output: Output.object({ schema: addressSchema }),
      maxOutputTokens: 250,
      temperature: 0,
      timeout: config.AGENT_LLM_FAST_TIMEOUT_MS,
    });
    onLlmSuccess();
    return output.candidates.slice(0, 3);
  } catch (err) {
    onLlmFailure();
    console.error('[agent.llm] disambiguateAddress error', (err as Error).message);
    return [];
  }
}

// ── Circuit breaker status (for health check) ─────────────────────────────────
export function getLlmCircuitStatus(): { open: boolean; failures: number } {
  return { open: isCircuitOpen(), failures: consecutiveFailures };
}
