import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Shows "Brain: X docs, Y words" or a red banner when no Brain docs exist (admin screens only). */
export default function BrainSummary({ bannerOnly = false }: { bannerOnly?: boolean }) {
  const [stats, setStats] = useState<{ docs: number; words: number } | null>(null);
  useEffect(() => {
    supabase.from('knowledge_docs').select('word_count').eq('source_type', 'brain')
      .then(({ data }) => setStats({ docs: data?.length ?? 0, words: (data ?? []).reduce((n, d) => n + (d.word_count ?? 0), 0) }));
  }, []);
  if (!stats) return null;
  if (stats.docs === 0) {
    return (
      <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-2.5">
        Brain not loaded — upload the brain files as "Dan's Brain (rulebook)"
      </div>
    );
  }
  if (bannerOnly) return null;
  return <p className="mb-4 text-xs text-muted-foreground">Brain: {stats.docs} docs, {stats.words.toLocaleString()} words</p>;
}
