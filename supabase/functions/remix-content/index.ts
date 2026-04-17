import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Uses Lovable's built-in AI Gateway via SUPABASE_URL/functions/v1/ai-completions
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // AI Gateway is built-in, no API key check needed

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

    // Get business overview from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_overview")
      .eq("id", user.id)
      .single()

    const businessOverview = profile?.business_overview || "a coaching or service business"

    const { postCaption, postUrl, platform, format } = await req.json()
    const chosenFormat: "reel" | "carousel" = format === "carousel" ? "carousel" : "reel"

    const reelFramework = `SHORT-FORM VIDEO (REEL) — 5 STEP FRAMEWORK:
1. HOOK (0–3 sec): Pattern interrupt or bold claim that calls out the target audience by name or pain.
2. CONTEXT (3–6 sec): One sentence framing what the video is about and confirming the viewer is in the right place.
3. VALUE (6–35 sec): The core teach/show — 1–2 points max, adapted to the business niche.
4. PROOF (35–45 sec): A result, stat, testimonial snippet, or relatable scenario that validates the value.
5. CTA (45–60 sec): One single action — comment, follow, DM, visit. No more than one ask.
RULE: Preserve the original video's format (talking head, B-roll, text-only). Only swap language, examples, and CTA to match the business.`

    const carouselFramework = `CAROUSEL — 7 SLIDE FRAMEWORK:
S1 COVER: Bold standalone headline that promises a specific outcome. No logo.
S2 PROBLEM: Name the specific pain. Make them feel seen. One problem, plainly stated.
S3 VALUE: Point 1 — one teach/insight, minimal text.
S4 VALUE: Point 2 — next step or insight.
S5 VALUE: Point 3 — final teach point.
S6 PROOF: A specific stat, result, testimonial, or before/after.
S7 CTA: One clear action (DM, link in bio, follow, save) + brand handle.
RULE: Each slide must read as a standalone image. Keep text minimal per slide.`

    const framework = chosenFormat === "carousel" ? carouselFramework : reelFramework

    const systemPrompt = `You are a content strategist remixing a viral Instagram post for a specific business.

BUSINESS CONTEXT:
${businessOverview}

YOUR TASK:
Take the original Instagram post (caption below) and remix its core idea into a NEW ${chosenFormat === "carousel" ? "CAROUSEL" : "SHORT-FORM REEL"} script tailored to the business above.

FRAMEWORK TO FOLLOW EXACTLY:
${framework}

OUTPUT FORMAT:
Return the remix structured by each step/slide. Use the step labels (e.g. "1. HOOK" or "S1 COVER") as headers. Under each, write the actual copy/script the user can use word-for-word. Keep it punchy, specific to the business, and ready to film/publish.`

    const userMessage = `Original Instagram ${chosenFormat === "carousel" ? "post" : "reel"} caption:\n"${postCaption || "(no caption — use the post URL context)"}"\n\nPost URL: ${postUrl}\n\nRemix this into a ${chosenFormat === "carousel" ? "carousel" : "reel"} for my business following the framework exactly.`

    const aiResponse = await fetch(`https://ai.gateway.lovable.dev/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1200,
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
    const remix = aiData.choices?.[0]?.message?.content || ""

    return new Response(
      JSON.stringify({ remix }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
