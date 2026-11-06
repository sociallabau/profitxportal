import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { touchLabel, type TouchKind } from '@/lib/clientCare';

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
