import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Target } from 'lucide-react';

/**
 * The client's round-up of their own month.
 *
 * Reads through my_monthly_reviews(), which returns the summary and nothing
 * else — Dan's breakdown of the same month is not reachable from here even by
 * calling the API directly.
 */

interface Review {
  month: string;
  client_summary: string;
  focus: string | null;
  created_at: string;
}

export default function MonthlyReview() {
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('my_monthly_reviews');
      const rows = (data ?? []) as Review[];
      if (rows.length) setReview(rows[0]);
    })();
  }, []);

  if (!review) return null;

  const monthLabel = new Date(review.month).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="mt-8 border border-primary/25 bg-primary/5 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-xs uppercase tracking-wider text-primary font-semibold">
          Dan's read on {monthLabel}
        </h3>
      </div>

      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {review.client_summary}
      </p>

      {review.focus && (
        <div className="flex items-start gap-2.5 mt-4 pt-4 border-t border-primary/20">
          <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Focus this month
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{review.focus}</p>
          </div>
        </div>
      )}
    </div>
  );
}
