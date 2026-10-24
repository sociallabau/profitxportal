import { supabase } from '@/lib/supabase';

/** Status-only SSE: unchecked model text is never part of this transport. */
export async function askDanStream(body: Record<string, unknown>, onStatus: (status: string) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again');
  const response = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/ask-dan`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not get an answer — try again');
  }
  if (!response.body) throw new Error('No answer received');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer: Record<string, unknown> | null = null;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      const type = event.split('\n').find(l => l.startsWith('event: '))?.slice(7);
      const payload = event.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
      if (!payload) continue;
      const data = JSON.parse(payload);
      if (type === 'error') throw new Error(data.error);
      if (type === 'status') onStatus(data.status);
      if (type === 'answer') answer = data;
    }
    if (done) break;
  }
  if (!answer) throw new Error('No checked answer received — try again');
  return answer;
}