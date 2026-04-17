import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")
const APIFY_ACTOR = "apify~instagram-scraper"
const APIFY_BASE = "https://api.apify.com/v2"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!APIFY_TOKEN) {
      return new Response(
        JSON.stringify({ error: "APIFY_API_TOKEN secret is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { mode, query } = await req.json()

    if (!query || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mode and query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let apifyInput: Record<string, unknown>

    if (mode === "handle") {
      const handle = query.replace(/^@/, "").trim()
      apifyInput = {
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsType: "posts",
        resultsLimit: 24,
        addParentData: false,
      }
    } else {
      const keyword = query.replace(/^#/, "").trim().replace(/\s+/g, "")
      // Use directUrls for hashtag search — more reliable than `hashtags` param
      apifyInput = {
        directUrls: [`https://www.instagram.com/explore/tags/${keyword}/`],
        resultsType: "posts",
        resultsLimit: 24,
        addParentData: false,
        searchType: "hashtag",
        searchLimit: 1,
      }
    }

    console.log("Apify input:", JSON.stringify(apifyInput))

    const apifyUrl = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90&memory=512`

    const apifyResponse = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyInput),
    })

    if (!apifyResponse.ok) {
      const errText = await apifyResponse.text()
      return new Response(
        JSON.stringify({ error: `Apify error: ${apifyResponse.status} - ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const rawPosts = await apifyResponse.json()
    console.log(`Apify returned ${Array.isArray(rawPosts) ? rawPosts.length : 0} items`)
    if (Array.isArray(rawPosts) && rawPosts.length > 0) {
      console.log("Sample item keys:", Object.keys(rawPosts[0]).join(","))
    }

    if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
      return new Response(
        JSON.stringify({ posts: [], count: 0, avgLikes: 0, avgViews: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Hashtag search may return a wrapper object with `topPosts`/`latestPosts` arrays
    let items: any[] = rawPosts
    if (rawPosts.length > 0 && (rawPosts[0].topPosts || rawPosts[0].latestPosts)) {
      const wrapper = rawPosts[0]
      items = [...(wrapper.topPosts || []), ...(wrapper.latestPosts || [])]
      console.log(`Unwrapped hashtag results: ${items.length} posts`)
    }

    // Filter out items that are clearly not posts (no shortcode/id)
    items = items.filter((p: any) => p && (p.shortCode || p.shortcode || p.id))

    // Map to consistent shape
    const posts = items.map((p: any) => ({
      id: p.id || p.shortCode || p.shortcode,
      shortCode: p.shortCode || p.shortcode || "",
      thumbnail: p.displayUrl || p.imageUrl || p.thumbnailUrl || p.thumbnail_src || p.thumbnailSrc || "",
      videoUrl: p.videoUrl || p.videoPlayUrl || p.video_url || null,
      postUrl: p.url || `https://www.instagram.com/p/${p.shortCode || p.shortcode}/`,
      caption: p.caption || p.alt || p.edge_media_to_caption?.edges?.[0]?.node?.text || "",
      likes: p.likesCount || p.likes || p.edge_liked_by?.count || p.edge_media_preview_like?.count || 0,
      comments: p.commentsCount || p.comments || p.edge_media_to_comment?.count || 0,
      views: p.videoViewCount || p.views || p.playsCount || p.video_view_count || 0,
      timestamp: p.timestamp || p.takenAt || p.taken_at_timestamp || "",
      ownerUsername: p.ownerUsername || p.username || p.owner?.username || "",
      type: p.type || (p.isVideo || p.is_video ? "Video" : "Image"),
      outlierScore: 1.0,
    }))

    // Calculate outlier scores
    const avgLikes = posts.reduce((sum: number, p: any) => sum + p.likes, 0) / posts.length
    const avgViews = posts.reduce((sum: number, p: any) => sum + p.views, 0) / posts.length

    posts.forEach((p: any) => {
      const metric = p.views > 0 ? p.views : p.likes
      const avg = p.views > 0 ? avgViews : avgLikes
      p.outlierScore = avg > 0 ? parseFloat((metric / avg).toFixed(2)) : 1.0
    })

    // Sort by outlier score descending
    posts.sort((a: any, b: any) => b.outlierScore - a.outlierScore)

    return new Response(
      JSON.stringify({ posts, count: posts.length, avgLikes: Math.round(avgLikes), avgViews: Math.round(avgViews) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
