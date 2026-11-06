import { useState, type KeyboardEvent } from 'react';
import { ArrowUp, CalendarClock } from 'lucide-react';
import { useLogContactChat } from '@/hooks/useClientCare';

/**
 * Type what you did — "booked a call with Harry Tuesday 8:15am", "just spoke to Zac on
 * WhatsApp" — and it updates the health board the same way the quick-log buttons do.
 * Scoped to one client when `clientId` is given (from their own panel), otherwise free text
 * names who it's about.
 */
export default function HealthChatBox({ clientId, clientName }: { clientId?: string | null; clientName?: string | null }) {
  const [text, setText] = useState('');
  const log = useLogContactChat();

  const send = () => {
    const asked = text.trim();
    if (!asked || log.isPending) return;
    setText('');
    log.mutate({ text: asked, clientId });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
      <CalendarClock className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKey}
        disabled={log.isPending}
        placeholder={clientName ? `Booked ${clientName} in for... (e.g. Tuesday 8:15am)` : "Who did you contact or book in? e.g. \"booked a call with Harry Tuesday 8:15am\""}
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={send}
        disabled={log.isPending || !text.trim()}
        aria-label="Log it"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full violet-grad text-white disabled:opacity-40"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
}
