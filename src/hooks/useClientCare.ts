import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { formatShortDateTime, touchLabel, type TouchKind } from '@/lib/clientCare';

export type LogTouchInput = { clientId: string; kind: TouchKind; occurredAt?: string; note?: string; clientName?: string | null };

/**
 * Record that Dan or Emily just spoke to a client. Used by the quick buttons on
 * the list and the fuller form in the client panel, so both write the same row.
 */
export function useLogTouchpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, kind, occurredAt, note }: LogTouchInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('client_touchpoints').insert({
        client_id: clientId,
        kind,
        occurred_at: occurredAt ?? new Date().toISOString(),
        note: note?.trim() || null,
        author_id: auth.user?.id ?? null,
        source: 'manual',
      }).select('id').single();
      if (error) throw error;
      return { kind, id: data?.id as string | undefined };
    },
    onSuccess: ({ kind, id }, { clientId, clientName }) => {
      const refresh = () => {
        qc.invalidateQueries({ queryKey: ['client-touchpoints'] });
        qc.invalidateQueries({ queryKey: ['client-touchpoints', clientId] });
      };
      refresh();
      // A stray tap would quietly record a conversation that never happened, so every log can be undone.
      toast.success(`${touchLabel(kind)} logged${clientName ? ` for ${clientName}` : ''}`, {
        duration: 8000,
        action: id ? {
          label: 'Undo',
          onClick: async () => {
            const { error } = await supabase.from('client_touchpoints').delete().eq('id', id);
            if (error) toast.error(error.message); else { refresh(); toast('Removed'); }
          },
        } : undefined,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type ContactLogged = {
  ok: true; when: 'past' | 'future'; client_id: string; client_name: string;
  scheduled_at: string; kind: TouchKind; note: string | null; touchpoint_id: string | null;
};
type ContactLogFailed = { ok: false; reason: string; message: string };

/**
 * supabase-js never reads the edge function's own response body on a non-2xx: the error it
 * throws just says "Edge Function returned a non-2xx status code" no matter what the function
 * actually said. The real message is sitting unread on error.context (the raw Response), so
 * pull it out ourselves — otherwise every failure looks identical and nothing is diagnosable
 * from the toast alone.
 */
async function edgeErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string' && body.error) return body.error;
      if (typeof body?.message === 'string' && body.message) return body.message;
    } catch {
      // Body wasn't JSON (or was already consumed) — fall through to whatever we have.
    }
  }
  return (error as Error | null)?.message || fallback;
}

/**
 * Client Health chat: "booked a call with Harry Tuesday 8:15am" — the ask-dan edge function
 * resolves who, when and what kind of contact, then writes a touchpoint (already happened) or
 * a booked next_contact_at on client_care (still ahead). Either write can be undone.
 */
export function useLogContactChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, clientId }: { text: string; clientId?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('ask-dan', { body: { action: 'client_health_log', text, client_id: clientId } });
      if (error) throw new Error(await edgeErrorMessage(error, "Couldn't reach Dan AI — try again"));
      const result = data as ContactLogged | ContactLogFailed;
      // Couldn't tell who or when: say so rather than write a guess.
      if (!result.ok) throw new Error((result as ContactLogFailed).message || "Couldn't log that — try again");
      return result as ContactLogged;
    },
    onSuccess: (result) => {
      const refresh = () => {
        qc.invalidateQueries({ queryKey: ['client-touchpoints'] });
        qc.invalidateQueries({ queryKey: ['client-care'] });
        qc.invalidateQueries({ queryKey: ['client-care-row'] });
      };
      refresh();
      const headline = result.when === 'future'
        ? `Booked for ${formatShortDateTime(new Date(result.scheduled_at))}`
        : `${touchLabel(result.kind)} logged`;
      toast.success(`${headline} — ${result.client_name}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            const undo = result.when === 'future'
              ? supabase.from('client_care').update({ next_contact_at: null, next_contact_kind: null, next_contact_note: null, next_contact_by: null }).eq('client_id', result.client_id)
              : result.touchpoint_id ? supabase.from('client_touchpoints').delete().eq('id', result.touchpoint_id) : null;
            if (!undo) return;
            const { error } = await undo;
            if (error) toast.error(error.message); else { refresh(); toast('Removed'); }
          },
        },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
