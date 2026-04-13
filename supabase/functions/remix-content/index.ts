import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const authHeader = req.headers.get("Authorization")
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let businessOverview = ""
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "")
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("business_overview")
          .eq("id", user.id)
          .single()
        businessOverview = profile?.business_overview || ""
      }
    }

    const { caption, hashtags, views, likes, comments, username } = await req.json()

    if (!businessOverview) {
      return new Response(
        JSON.stringify({ error: "NO_BUSINESS_OVERVIEW" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const hashtagList = Array.isArray(hashtags) ? hashtags.slice(0, 15).join(" ") : ""
    const stats = `${(views || 0).toLocaleString()} views, ${(likes || 0).toLocaleString()} likes, ${(comments || 0).toLocaleString()} comments`

    const systemPrompt = `You are a social media content strategist specialising in video content for service-based businesses (construction, real estate, mortgage brokers, trades, and similar industries).

A business owner has found a top-performing Instagram video and wants to create their own inspired version, adapted entirely to their business, clients, and unique style.

Your job is to:
1. Identify the core hook, structure, and angle that made the original video perform well
2. Write a practical dot-point script they can follow to film their own version, using their specific business context so every line feels natural and personal

Rules:
- Keep the script short, aim for a 30 to 60 second Reel
- Write conversationally, not like a corporate ad
- Every point must connect to their specific niche, clients, and advantage
- Do not reference or mention the original creator or video
- Sound like a real person talking, not a marketing script

Format your response exactly like this, use these exact headings:

**Hook (first 3 seconds):**
[One punchy, curiosity-driving opening line that will stop the scroll]

**Main Points:**
- [Point 1]
- [Point 2]
- [Point 3]

**Call to Action:**
[One natural, low-pressure closing line]

**Why this angle works for your business:**
[2-3 sentences explaining the content strategy and why this angle resonates with their specific audience]`

    const userMessage = `Original video context:
Account: @${username || "unknown"}
Caption: ${caption || "(no caption)"}
Hashtags: ${hashtagList || "(none)"}
Performance: ${stats}

My business:
${businessOverview}`

    // Use Lovable AI Gateway
    const aiResponse = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 600,
      }),
    })

    if (!aiResponse.ok) {
      const err = await aiResponse.text()
      return new Response(
        JSON.stringify({ error: `AI error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const aiData = await aiResponse.json()
    const script = aiData.choices?.[0]?.message?.content || ""

    return new Response(
      JSON.stringify({ script }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
