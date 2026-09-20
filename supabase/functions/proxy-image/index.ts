import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require authenticated caller
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  } catch {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing url param', { status: 400, headers: corsHeaders });
  }

  let target: URL;
  try {
    target = new URL(decodeURIComponent(imageUrl));
  } catch {
    return new Response('Invalid url', { status: 400, headers: corsHeaders });
  }

  if (target.protocol !== 'https:') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }
  const hostname = target.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const imageResponse = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bot)',
        'Referer': 'https://www.instagram.com/',
      },
      redirect: 'manual',
    });

    const contentType = imageResponse.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new Response('Forbidden content type', { status: 415, headers: corsHeaders });
    }

    const buffer = await imageResponse.arrayBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('Failed to fetch image', { status: 500, headers: corsHeaders });
  }
});
