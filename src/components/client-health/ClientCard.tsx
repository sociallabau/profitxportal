import type { KeyboardEvent } from 'react';
import QuickLog from '@/components/client-health/QuickLog';
import { BUCKET_STYLE, STATUS_STYLE } from '@/lib/clientCare';
import { factsLine, initials } from '@/lib/clientDisplay';
import type { ClientWithHealth } from '@/lib/clientHealth';

/**
 * One client who needs someone. The bar on the left carries the urgency, the
 * sentence says why in plain English, the icons log that you've dealt with them.
 */
export default function ClientCard({ client, onOpen }: { client: ClientWithHealth; onOpen: () => void }) {
  const b = BUCKET_STYLE[client.attention.bucket];
  const s = STATUS_STYLE[client.status];
  const reasons = client.attention.reasons;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKey}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card/80 p-4 pl-3 shadow-sm backdrop-blur-sm cursor-pointer transition hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className={`w-1 self-stretch rounded-full ${b.bar}`} aria-hidden />
      <span className={`hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-full ${b.bg} ${b.text} text-sm font-bold`} aria-hidden>
        {initials(client.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="font-semibold text-foreground truncate">{client.full_name || 'Unnamed'}</p>
          {client.attention.drifting && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">Drifting</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}{client.overridden ? ' ★' : ''}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground/85 leading-snug">{reasons.slice(0, 3).join(' · ') || b.hint}</p>
        <p className="mt-1 text-xs text-muted-foreground">{factsLine(client)}</p>
      </div>
      <QuickLog clientId={client.id} clientName={client.full_name} />
    </div>
  );
}
