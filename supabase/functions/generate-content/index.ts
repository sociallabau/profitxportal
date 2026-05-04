import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are a content writer for a videographer who runs a retainer-based content business.
You write in a direct, plain, conversational tone — the way someone would talk to a client over coffee, not in a boardroom.

You are given:
- Business context: who they are, what they do, who they help
- The content framework (Problem / Plan / Proof / Philosophy)
- Their answer to a prompting question

Your job is to generate three content pieces from this.

STRICT TONE RULES — follow these exactly:
- No em dashes anywhere
- No rhetorical questions that answer themselves ("Sound familiar?" / "Know the feeling?")
- No "not X, not Y, just Z" sentence constructions
- No "in today's world" or "in this day and age"
- No "here's the thing"
- No double negatives
- No open-ended questions used as hooks
- No AI-sounding filler phrases
- Write short sentences. Vary the rhythm. Sound like a real person.
- Mirror the tone and language style from the business context provided. If they sound casual, be casual. If they're direct and punchy, match that.
- Never start a sentence with "Remember" or "Look"
- No motivational poster language

OUTPUT FORMAT — return exactly this structure, no extra commentary:

REEL_FRAMEWORK:
[5-7 dot points, each a direction not a script line. Include opening hook direction and closing CTA direction. Use "- " prefix for each bullet.]

CAROUSEL:
[5-7 slides. Format each as "Slide N — Headline" on one line, then 1-2 short supporting lines below. First slide is hook (no question marks), final slide is CTA.]

EMAIL_SUBJECT:
[one line, no quotes]

EMAIL_BODY:
[200-300 words plain prose, no bullet lists]`;

function buildPartPrompt(part: "all" | "reel" | "carousel" | "email") {
  if (part === "all") return SYSTEM_PROMPT;
  const sectionMap = {
    reel: "REEL_FRAMEWORK:\n[5-7 dot points using '- ' prefix]",
    carousel: "CAROUSEL:\n[5-7 slides as 'Slide N — Headline' then 1-2 supporting lines]",
    email: "EMAIL_SUBJECT:\n[one line]\n\nEMAIL_BODY:\n[200-300 words plain prose]",
  };
  return SYSTEM_PROMPT.replace(
    /OUTPUT FORMAT[\s\S]*$/,
    `OUTPUT FORMAT — return exactly this structure, no extra commentary:\n\n${sectionMap[part]}`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_overview")
      .eq("id", user.id)
      .maybeSingle();

    const businessOverview = profile?.business_overview || "(not provided)";

    const { pillar, question, answer, part } = await req.json();
    const which: "all" | "reel" | "carousel" | "email" =
      part === "reel" || part === "carousel" || part === "email" ? part : "all";

    const userMessage = `Business context:
${businessOverview}

Content framework selected: ${pillar}

Prompting question: ${question}

Their answer to the prompting question:
${answer}

Generate ${which === "all" ? "the reel framework, carousel, and email" : `only the ${which}`} now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildPartPrompt(which) },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI error: ${err}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const text = aiData.choices?.[0]?.message?.content || "";

    // Parse sections
    const parsed: { reel?: string; carousel?: string; emailSubject?: string; emailBody?: string } = {};
    const reelMatch = text.match(/REEL_FRAMEWORK:\s*([\s\S]*?)(?=\n\s*(?:CAROUSEL:|EMAIL_SUBJECT:|EMAIL_BODY:)|$)/i);
    const carouselMatch = text.match(/CAROUSEL:\s*([\s\S]*?)(?=\n\s*(?:REEL_FRAMEWORK:|EMAIL_SUBJECT:|EMAIL_BODY:)|$)/i);
    const subjMatch = text.match(/EMAIL_SUBJECT:\s*([\s\S]*?)(?=\n\s*(?:REEL_FRAMEWORK:|CAROUSEL:|EMAIL_BODY:)|$)/i);
    const bodyMatch = text.match(/EMAIL_BODY:\s*([\s\S]*?)$/i);

    if (reelMatch) parsed.reel = reelMatch[1].trim();
    if (carouselMatch) parsed.carousel = carouselMatch[1].trim();
    if (subjMatch) parsed.emailSubject = subjMatch[1].trim();
    if (bodyMatch) parsed.emailBody = bodyMatch[1].trim();

    // Fallback: if only one section requested and parse failed, use full text
    if (which !== "all") {
      if (which === "reel" && !parsed.reel) parsed.reel = text.trim();
      if (which === "carousel" && !parsed.carousel) parsed.carousel = text.trim();
      if (which === "email" && !parsed.emailBody) parsed.emailBody = text.trim();
    }

    return new Response(JSON.stringify({ ...parsed, raw: text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
