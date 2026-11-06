import { MessageCircle, Phone, CalendarCheck } from 'lucide-react';
import { useLogTouchpoint } from '@/hooks/useClientCare';
import type { TouchKind } from '@/lib/clientCare';

const BUTTONS: { kind: TouchKind; label: string; Icon: typeof Phone }[] = [
  { kind: 'whatsapp', label: 'Spoke on WhatsApp', Icon: MessageCircle },
  { kind: 'call', label: 'Had a call', Icon: Phone },
  { kind: 'quarterly_call', label: 'Quarterly call done', Icon: CalendarCheck },
];

/** One-tap "I just spoke to them" buttons: logs the contact as happening now. */
export default function QuickLog({ clientId, clientName }: { clientId: string; clientName?: string | null }) {
  const log = useLogTouchpoint();
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {BUTTONS.map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          title={label}
          aria-label={label}
          disabled={log.isPending}
          onClick={() => log.mutate({ clientId, kind, clientName })}
          className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary transition disabled:opacity-50"
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
