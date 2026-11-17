import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { pollMessages, resetSession, sendMessage } from './api';
import type { ChatEntry, WhatsAppOutboundMessage } from './types';

const DEFAULT_PHONE = '+24177234561';
// Fallback pickup used by the 📍 button — Libreville centre (Rue Ndende).
// Free-text addresses go through the real disambiguation flow instead.
const DEFAULT_LOCATION = { lat: 0.3924, lon: 9.4536, address: '356 Rue Ndende, Libreville, Gabon' };

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

export default function App() {
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [phoneInput, setPhoneInput] = useState(DEFAULT_PHONE);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendAgentMessages = (messages: WhatsAppOutboundMessage[]) => {
    if (messages.length === 0) return;
    setEntries((prev) => [
      ...prev,
      ...messages.map((message) => ({ id: nextId(), from: 'agent' as const, message, ts: Date.now() })),
    ]);
  };

  // Poll for messages triggered asynchronously (a real driver bidding/progressing
  // the trip from the mobile app) every 3s.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { messages } = await pollMessages(phone);
        appendAgentMessages(messages);
      } catch {
        // Non-fatal — retried on next tick
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [phone]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  async function runTurn(input: Parameters<typeof sendMessage>[1], userBubble?: WhatsAppOutboundMessage) {
    if (userBubble) {
      setEntries((prev) => [...prev, { id: nextId(), from: 'user', message: userBubble, ts: Date.now() }]);
    }
    setSending(true);
    try {
      const { messages } = await sendMessage(phone, input);
      appendAgentMessages(messages);
    } catch (err) {
      appendAgentMessages([{ type: 'text', body: `⚠️ Erreur : ${(err as Error).message}` }]);
    } finally {
      setSending(false);
    }
  }

  function handleSendText() {
    const value = text.trim();
    if (!value || sending) return;
    setText('');
    runTurn({ type: 'text', text: value }, { type: 'text', body: value });
  }

  function handleSelect(id: string, title: string) {
    if (sending) return;
    runTurn({ type: 'menu_selection', id, title }, { type: 'text', body: title });
  }

  function handleShareLocation() {
    if (sending) return;
    runTurn(
      { type: 'location', ...DEFAULT_LOCATION },
      { type: 'text', body: `📍 Position partagée : ${DEFAULT_LOCATION.address}` },
    );
  }

  function handlePhoneApply() {
    const normalized = phoneInput.trim();
    setPhone(normalized);
    setEntries([]);
  }

  async function handleReset() {
    await resetSession(phone);
    setEntries([]);
  }

  return (
    <div className="min-h-screen bg-wa-bg flex flex-col items-center py-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-wa-teal text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold">HelloDriver 🚖</p>
            <p className="text-xs text-white/70">Simulateur WhatsApp — démo</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
            title="Effacer la conversation et repartir de zéro"
          >
            Réinitialiser
          </button>
        </div>

        {/* Phone picker */}
        <div className="bg-wa-panel px-4 py-2 flex items-center gap-2 border-b border-gray-200">
          <label className="text-xs text-gray-500 shrink-0">Numéro :</label>
          <input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePhoneApply()}
            className="flex-1 text-sm px-2 py-1 rounded border border-gray-300"
            placeholder="+24177234561"
          />
          <button
            onClick={handlePhoneApply}
            className="text-xs bg-wa-green text-white px-2 py-1 rounded"
          >
            Changer
          </button>
        </div>

        {/* Chat */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 bg-wa-bg">
          {entries.length === 0 && (
            <p className="text-center text-xs text-gray-500 mt-8">
              Envoyez un premier message pour démarrer la conversation avec l'agent HelloDriver.
            </p>
          )}
          {entries.map((entry) => (
            <MessageBubble key={entry.id} entry={entry} onSelect={handleSelect} />
          ))}
          {sending && (
            <p className="text-xs text-gray-400 italic">HelloDriver écrit...</p>
          )}
        </div>

        {/* Input */}
        <div className="bg-wa-panel px-3 py-2 flex items-center gap-2 border-t border-gray-200">
          <button
            onClick={handleShareLocation}
            title="Partager ma position (Libreville centre)"
            className="text-lg px-1"
            disabled={sending}
          >
            📍
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Écrivez un message..."
            className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-300"
            disabled={sending}
          />
          <button
            onClick={handleSendText}
            disabled={sending || !text.trim()}
            className="bg-wa-green text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
