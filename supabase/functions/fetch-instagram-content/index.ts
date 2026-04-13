const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")
const APIFY_ACTOR = "apify~instagram-scraper"
const APIFY_BASE = "https://api.apify.com/v2"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!APIFY_TOKEN) {
      return new Response(
        JSON.stringify({ error: "APIFY_API_TOKEN secret is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { mode, query, sort_by } = await req.json()

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
        addParentData: true,
      }
    } else {
      const keyword = query.replace(/^#/, "").trim().replace(/\s+/g, "")
      apifyInput = {
        hashtags: [`#${keyword}`],
        resultsType: "posts",
        resultsLimit: 24,
        addParentData: false,
      }
    }

    const apifyUrl = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=55&memory=256`

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

    if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const posts = rawPosts
      .filter((p: any) => p && (p.videoViewCount > 0 || p.type === "Video" || p.isVideo))
      .map((p: any) => ({
        id: p.id || p.shortCode,
        shortCode: p.shortCode || "",
        url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
        thumbnailUrl: p.displayUrl || p.thumbnailUrl || p.previewImageUrl || "",
        videoUrl: p.videoUrl || "",
        caption: p.caption || p.alt || "",
        hashtags: p.hashtags || [],
        views: p.videoViewCount || p.playsCount || 0,
        likes: p.likesCount || 0,
        comments: p.commentsCount || 0,
        saves: p.savesCount || 0,
        shares: p.sharesCount || 0,
        timestamp: p.timestamp || p.takenAt || "",
        ownerUsername: p.ownerUsername || p.username || "",
        ownerFullName: p.ownerFullName || p.fullName || "",
        ownerProfilePicUrl: p.ownerProfilePicUrl || p.profilePicUrl || "",
        ownerFollowersCount: p.ownerFollowersCount || p.followersCount || 0,
      }))

    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate Outlier Scores
    const allViews = posts.map((p: any) => p.views).filter((v: number) => v > 0).sort((a: number, b: number) => a - b)
    const medianViews = allViews.length > 0 ? allViews[Math.floor(allViews.length / 2)] : 1

    const allER = posts.map((p: any) => {
      if (p.views === 0) return 0
      return (p.likes + p.comments + p.saves + p.shares) / p.views
    }).filter((er: number) => er >= 0).sort((a: number, b: number) => a - b)
    const medianER = allER.length > 0 ? allER[Math.floor(allER.length / 2)] : 0.03

    const scoredPosts = posts.map((p: any) => {
      const baselineViews = medianViews || 1
      const baselineER = medianER || 0.03

      const targetER = p.views > 0 ? (p.likes + p.comments + p.saves + p.shares) / p.views : 0
      const erRatio = baselineER > 0 ? targetER / baselineER : 1

      let isBoosted = false
      let confidenceModifier = 1.0
      if (erRatio < 0.4 && p.views > baselineViews * 2) {
        isBoosted = true
        confidenceModifier = 0.6
      } else if (erRatio > 1.2) {
        confidenceModifier = 1.1
      }

      const rawMultiplier = baselineViews > 0 ? p.views / baselineViews : 1
      const adjustedMultiplier = rawMultiplier * confidenceModifier

      let velocityBoost = 0
      if (p.timestamp) {
        const hoursOld = (Date.now() - new Date(p.timestamp).getTime()) / 3600000
        if (hoursOld < 48 && hoursOld > 0) {
          const vph = p.views / hoursOld
          const baselineVph = baselineViews / 24
          velocityBoost = Math.min((vph / (baselineVph || 1)) * 0.15, 0.5)
        }
      }

      const finalScore = Math.round((adjustedMultiplier + velocityBoost) * 10) / 10

      let label = "Normal"
      if (finalScore >= 4.0) label = "Mega Viral"
      else if (finalScore >= 2.5) label = "Viral"
      else if (finalScore >= 1.5) label = "Strong"

      return { ...p, outlierScore: finalScore, outlierLabel: label, isBoosted }
    })

    if (sort_by === "most_views") {
      scoredPosts.sort((a: any, b: any) => b.views - a.views)
    } else if (sort_by === "most_recent") {
      scoredPosts.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } else {
      scoredPosts.sort((a: any, b: any) => b.outlierScore - a.outlierScore)
    }

    return new Response(
      JSON.stringify({ results: scoredPosts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
