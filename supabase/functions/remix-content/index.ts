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

    const reelFramework = `SHORT REEL — 5 BEATS (write like a real person texting a mate, not a marketer):
1. HOOK (0–3s): A punchy line that stops the scroll. Call out who it's for or the pain. No jargon, no "in this video".
2. CONTEXT (3–6s): One quick line so they know they're in the right place.
3. VALUE (6–35s): The actual teach. 1–2 points max. Use plain words, real examples, contractions ("you're", "don't").
4. PROOF (35–45s): A real number, story, or "I had a client who..." moment. Keep it specific.
5. CTA (45–60s): One ask. Sound like a person — "comment X", "DM me 'word'", "follow for more". Not "click the link in my bio to learn more about our services".
TONE RULES: short sentences. No buzzwords (unlock, leverage, elevate, transform). No emojis unless they fit. Sound like the user is talking to one person, not an audience.`

    const carouselFramework = `CAROUSEL — 7 SLIDES (write it casual, like you're texting screenshots to a friend):
S1 COVER: Bold one-liner that promises a clear outcome. Plain English. No logo.
S2 PROBLEM: Name the pain in their own words. One sentence. Make them go "yep that's me".
S3 VALUE: Point 1. Keep text minimal — say it like you'd say it out loud.
S4 VALUE: Point 2. Same vibe.
S5 VALUE: Point 3. Same vibe.
S6 PROOF: A real result, number, or short client story. Specific beats clever.
S7 CTA: One simple ask + handle. "DM me 'word'", "save this for later", "follow for more like this".
TONE RULES: contractions, short lines, no marketing fluff. Avoid "unlock, leverage, transform, game-changing, elevate". Write to one person.`

    const framework = chosenFormat === "carousel" ? carouselFramework : reelFramework

    const systemPrompt = `You're helping a real business owner remix a viral Instagram post into their own content. Write like a normal human — not a marketing agency, not an AI.

ABOUT THEIR BUSINESS:
${businessOverview}

YOUR JOB:
Take the original post (caption below) and rewrite the idea as a NEW ${chosenFormat === "carousel" ? "CAROUSEL" : "SHORT REEL"} script for the business above.

FOLLOW THIS FRAMEWORK:
${framework}

HOW TO WRITE:
- Casual, conversational, relatable. Like you're talking to a mate.
- Use contractions. Short sentences. Real examples from the business niche.
- NO AI tells: no "in today's fast-paced world", no "unlock", "leverage", "elevate", "transform", "game-changing", "let's dive in", em dashes everywhere, or robotic intros.
- NO hashtags, no emojis stuffed in for vibes.
- Sound like a person who's actually done the thing.

OUTPUT:
Use the step labels (e.g. "1. HOOK" or "S1 COVER") as headers. Under each, write the actual words to say/show — ready to film or post. No commentary, no explanations, just the script.`

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
