// Verifies an invite code server-side so the code is never exposed in the client bundle.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json().catch(() => ({ code: '' }));
    if (typeof code !== 'string' || code.length === 0 || code.length > 100) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid code format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expected = Deno.env.get('SIGNUP_CODE') ?? '';
    const valid = expected.length > 0 && code.trim() === expected.trim();

    return new Response(JSON.stringify({ valid }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
