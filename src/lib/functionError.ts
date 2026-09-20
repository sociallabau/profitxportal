/**
 * Pulls the real message out of a failed edge function call.
 *
 * supabase-js returns a FunctionsHttpError for any non-2xx response and leaves
 * the body unparsed, so the server's actual message is lost unless it is read
 * off the Response. Without this, a missing function and an expired API key
 * both surface as "try again".
 */
export async function functionErrorMessage(
  error: unknown,
  data: unknown,
): Promise<string | null> {
  const payload = data as { error?: string } | null;
  if (payload?.error) return payload.error;

  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text.slice(0, 300);
      } catch { /* nothing readable on the response */ }
    }
    if (context.status === 404) {
      return 'That function is not deployed yet — publish in Lovable and try again';
    }
  }

  if (error instanceof Error) return error.message;
  return null;
}
