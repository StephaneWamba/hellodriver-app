import type { ChatEntry } from './types';

interface Props {
  entry: ChatEntry;
  onSelect: (id: string, title: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ entry, onSelect }: Props) {
  const isAgent = entry.from === 'agent';
  const bubbleClass = isAgent
    ? 'bg-white text-gray-900'
    : 'bg-wa-bubble text-gray-900 ml-auto';

  const { message } = entry;

  return (
    <div className={`max-w-[80%] rounded-lg shadow-sm px-3 py-2 mb-2 ${bubbleClass}`}>
      {message.type === 'text' && (
        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
      )}

      {message.type === 'location_request' && (
        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
      )}

      {message.type === 'interactive_buttons' && (
        <div>
          <p className="whitespace-pre-wrap text-sm mb-2">{message.body}</p>
          <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
            {message.buttons.map((b) => (
              <button
                key={b.id}
                onClick={() => onSelect(b.id, b.title)}
                className="text-wa-teal text-sm font-medium py-1.5 rounded hover:bg-gray-50 text-center"
              >
                {b.title}
              </button>
            ))}
          </div>
          {message.footer && <p className="text-xs text-gray-400 mt-1">{message.footer}</p>}
        </div>
      )}

      {message.type === 'interactive_list' && (
        <div>
          {message.header && <p className="font-semibold text-sm mb-1">{message.header}</p>}
          <p className="whitespace-pre-wrap text-sm mb-2">{message.body}</p>
          <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
            {message.sections.map((section, si) => (
              <div key={si}>
                {section.title && (
                  <p className="text-xs font-semibold text-gray-500 mt-1">{section.title}</p>
                )}
                {section.rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => onSelect(row.id, row.title)}
                    className="w-full text-left py-1.5 rounded hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-900">{row.title}</span>
                    {row.description && (
                      <span className="block text-xs text-gray-500">{row.description}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {message.footer && <p className="text-xs text-gray-400 mt-1">{message.footer}</p>}
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-right mt-1">{formatTime(entry.ts)}</p>
    </div>
  );
}
