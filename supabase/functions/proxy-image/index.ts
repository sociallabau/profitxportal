const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing url param', { status: 400, headers: corsHeaders });
  }

  try {
    const imageResponse = await fetch(decodeURIComponent(imageUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bot)',
        'Referer': 'https://www.instagram.com/',
      },
    });

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
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
