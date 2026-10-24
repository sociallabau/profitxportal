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

/** The fields we read from Apify's instagram-scraper items (shape varies by actor version). */
type Count = { count?: number }
type ApifyItem = {
  id?: string; shortCode?: string; shortcode?: string; url?: string; type?: string; productType?: string; product_type?: string
  displayUrl?: string; imageUrl?: string; thumbnailUrl?: string; thumbnail_src?: string; thumbnailSrc?: string
  videoUrl?: string; videoPlayUrl?: string; video_url?: string; isVideo?: boolean; is_video?: boolean
  caption?: string; alt?: string; edge_media_to_caption?: { edges?: { node?: { text?: string } }[] }
  likesCount?: number; likes?: number; edge_liked_by?: Count; edge_media_preview_like?: Count
  commentsCount?: number; comments?: number; edge_media_to_comment?: Count
  videoViewCount?: number; views?: number; playsCount?: number; video_view_count?: number
  timestamp?: string; takenAt?: string; taken_at_timestamp?: string | number
  ownerUsername?: string; username?: string; ownerFollowersCount?: number; followersCount?: number
  owner?: { username?: string; followers_count?: number; edge_followed_by?: Count }
  topPosts?: ApifyItem[]; latestPosts?: ApifyItem[]
}

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
      // Hashtag "tags" page rarely returns reels. Hit the explore reels search instead.
      apifyInput = {
        directUrls: [
          `https://www.instagram.com/explore/search/keyword/?q=%23${keyword}`,
          `https://www.instagram.com/explore/tags/${keyword}/`,
        ],
        resultsType: "posts",
        resultsLimit: 80,
        addParentData: false,
        searchType: "hashtag",
        searchLimit: 1,
        enhanceUserSearchWithFacebookPage: false,
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
      console.error("Apify error:", apifyResponse.status, errText)
      return new Response(
        JSON.stringify({ error: "Content fetch failed. Try again later." }),
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
    let items: ApifyItem[] = rawPosts
    if (rawPosts.length > 0 && (rawPosts[0].topPosts || rawPosts[0].latestPosts)) {
      const wrapper = rawPosts[0]
      items = [...(wrapper.topPosts || []), ...(wrapper.latestPosts || [])]
      console.log(`Unwrapped hashtag results: ${items.length} posts`)
    }

    // Filter out items that are clearly not posts (no shortcode/id)
    items = items.filter((p) => p && (p.shortCode || p.shortcode || p.id))

    // Map to consistent shape
    let posts = items.map((p) => {
      const productType = (p.productType || p.product_type || "").toString().toLowerCase()
      const typeStr = (p.type || "").toString().toLowerCase()
      const isVideo = !!(p.videoUrl || p.videoPlayUrl || p.video_url || p.isVideo || p.is_video) || typeStr === "video" || productType.includes("clips") || productType === "reel"
      const isReel = productType.includes("clips") || productType === "reel" || typeStr === "video" || typeStr === "reel" || isVideo
      return {
        id: p.id || p.shortCode || p.shortcode,
        shortCode: p.shortCode || p.shortcode || "",
        thumbnail: p.displayUrl || p.imageUrl || p.thumbnailUrl || p.thumbnail_src || p.thumbnailSrc || "",
        videoUrl: p.videoUrl || p.videoPlayUrl || p.video_url || null,
        postUrl: p.url || `https://www.instagram.com/${isReel ? "reel" : "p"}/${p.shortCode || p.shortcode}/`,
        caption: p.caption || p.alt || p.edge_media_to_caption?.edges?.[0]?.node?.text || "",
        likes: p.likesCount || p.likes || p.edge_liked_by?.count || p.edge_media_preview_like?.count || 0,
        comments: p.commentsCount || p.comments || p.edge_media_to_comment?.count || 0,
        views: p.videoViewCount || p.views || p.playsCount || p.video_view_count || 0,
        timestamp: p.timestamp || p.takenAt || p.taken_at_timestamp || "",
        ownerUsername: p.ownerUsername || p.username || p.owner?.username || "",
        ownerFollowers: p.ownerFollowersCount || p.followersCount || p.owner?.followers_count || p.owner?.edge_followed_by?.count || 0,
        type: isReel ? "Reel" : (isVideo ? "Video" : "Image"),
        isReel,
        outlierScore: 1.0,
      }
    })

    // Keyword mode: prefer Reels (videos), then enrich with follower counts and filter to 5k+
    if (mode === "keyword") {
      const beforeReels = posts.length
      const reelsOnly = posts.filter((p) => p.isReel)
      console.log(`Reels filter: ${beforeReels} -> ${reelsOnly.length}`)
      // If reel detection wiped everything, fall back to all posts (better than 0 results)
      if (reelsOnly.length > 0) posts = reelsOnly

      // Enrich top candidates with follower count (parallel profile lookups, capped to 15)
      const candidates = posts.slice(0, 15).filter((p) => p.ownerUsername)
      const uniqueHandles = [...new Set(candidates.map((p) => p.ownerUsername))]
      console.log(`Enriching ${uniqueHandles.length} unique profiles for follower counts`)

      const followerMap = new Map<string, number>()
      await Promise.all(uniqueHandles.map(async (handle: string) => {
        try {
          const profileUrl = `${APIFY_BASE}/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30&memory=256`
          const r = await fetch(profileUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [handle] }),
          })
          if (!r.ok) return
          const arr = await r.json()
          const followers = arr?.[0]?.followersCount || arr?.[0]?.followers_count || 0
          followerMap.set(handle, followers)
        } catch (_) { /* swallow */ }
      }))

      const enriched = posts
        .map((p) => ({ ...p, ownerFollowers: followerMap.get(p.ownerUsername) || p.ownerFollowers || 0 }))
      const filtered = enriched.filter((p) => p.ownerFollowers >= 5000)
      console.log(`After 5k+ follower filter: ${filtered.length}`)
      // If follower enrichment failed for everyone (all 0), don't drop everything
      const anyFollowerData = enriched.some((p) => p.ownerFollowers > 0)
      posts = anyFollowerData ? filtered : enriched
    }

    posts = posts.slice(0, 24)

    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ posts: [], count: 0, avgLikes: 0, avgViews: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate outlier scores using MEDIAN (more robust against viral outliers)
    const median = (arr: number[]) => {
      const sorted = arr.filter(n => n > 0).sort((a, b) => a - b)
      if (sorted.length === 0) return 0
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    const medianViews = median(posts.map((p) => p.views))
    const medianLikes = median(posts.map((p) => p.likes))
    const avgLikes = posts.reduce((sum: number, p) => sum + p.likes, 0) / posts.length
    const avgViews = posts.reduce((sum: number, p) => sum + p.views, 0) / posts.length

    posts.forEach((p) => {
      const useViews = p.views > 0 && medianViews > 0
      const metric = useViews ? p.views : p.likes
      const baseline = useViews ? medianViews : medianLikes
      p.outlierScore = baseline > 0 ? parseFloat((metric / baseline).toFixed(2)) : 1.0
    })

    // Sort by outlier score descending
    posts.sort((a, b) => b.outlierScore - a.outlierScore)

    return new Response(
      JSON.stringify({ posts, count: posts.length, avgLikes: Math.round(avgLikes), avgViews: Math.round(avgViews) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("fetch-instagram-content error:", error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
