import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")

// Gemini multimodal cap — keep videos small to avoid timeouts/oversize payloads
const MAX_VIDEO_BYTES = 18 * 1024 * 1024

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as any)
  }
  return btoa(binary)
}

/**
 * Use Lovable AI (Gemini 2.5 Pro multimodal) to transcribe the video.
 * Returns transcript text or null on any failure.
 */
async function transcribeVideo(videoUrl: string): Promise<string | null> {
  if (!LOVABLE_API_KEY) {
    console.log("No LOVABLE_API_KEY — skipping transcription")
    return null
  }
  try {
    console.log("Downloading video for transcription:", videoUrl.substring(0, 80))
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      console.log("Video fetch failed:", videoRes.status)
      return null
    }
    const buf = new Uint8Array(await videoRes.arrayBuffer())
    if (buf.byteLength > MAX_VIDEO_BYTES) {
      console.log(`Video too large (${buf.byteLength} bytes), skipping`)
      return null
    }
    const base64 = bytesToBase64(buf)
    const mime = videoRes.headers.get("content-type") || "video/mp4"
    const dataUrl = `data:${mime};base64,${base64}`

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "You transcribe short-form videos. Return ONLY the spoken words from the video, verbatim, with no commentary, no timestamps, no speaker labels, no markdown. If the video has no speech, return the single word: NONE.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe the spoken audio in this video." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })

    if (!r.ok) {
      const errTxt = await r.text()
      console.log("Lovable AI transcription error:", r.status, errTxt.substring(0, 300))
      return null
    }
    const data = await r.json()
    const text = (data.choices?.[0]?.message?.content || "").trim()
    if (!text || text.toUpperCase() === "NONE") {
      console.log("Transcript empty / NONE")
      return null
    }
    console.log(`Transcript length: ${text.length}`)
    return text
  } catch (e: any) {
    console.log("Transcription exception:", e?.message)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_overview")
      .eq("id", user.id)
      .single()

    const businessOverview = profile?.business_overview || "a coaching or service business"

    const { postCaption, postUrl, videoUrl, format } = await req.json()
    const chosenFormat: "reel" | "carousel" = format === "carousel" ? "carousel" : "reel"

    // Try to use cached transcript if this post is already saved by this user
    let transcript: string | null = null
    if (postUrl) {
      const { data: saved } = await supabase
        .from("saved_ideas")
        .select("id, transcript, source_video_url")
        .eq("user_id", user.id)
        .eq("source_url", postUrl)
        .maybeSingle()

      if (saved?.transcript) {
        transcript = saved.transcript
        console.log("Using cached transcript")
      } else if (videoUrl) {
        transcript = await transcribeVideo(videoUrl)
        // Cache it on the saved row if it exists, so next remix is instant
        if (transcript && saved?.id) {
          await supabase
            .from("saved_ideas")
            .update({ transcript, source_video_url: videoUrl })
            .eq("id", saved.id)
        }
      }
    } else if (videoUrl) {
      transcript = await transcribeVideo(videoUrl)
    }

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
Take the original post (transcript and/or caption below) and rewrite the IDEA as a NEW ${chosenFormat === "carousel" ? "CAROUSEL" : "SHORT REEL"} script for the business above. The transcript is the SOURCE OF TRUTH for what was actually said in the video — use it to understand the real angle, hook structure, and value points. Don't copy it word-for-word; extract the underlying idea and rewrite it for this business.

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

    const sourceBlock = transcript
      ? `VIDEO TRANSCRIPT (what they actually said):\n"""\n${transcript}\n"""\n\nOriginal caption (for extra context):\n"${postCaption || "(no caption)"}"`
      : `Original Instagram ${chosenFormat === "carousel" ? "post" : "reel"} caption:\n"${postCaption || "(no caption — use the post URL context)"}"`

    const userMessage = `${sourceBlock}\n\nPost URL: ${postUrl}\n\nRemix this into a ${chosenFormat === "carousel" ? "carousel" : "reel"} for my business following the framework exactly.`

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
      console.error("AI error:", aiResponse.status, err)
      return new Response(
        JSON.stringify({ error: "AI request failed. Try again later." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const aiData = await aiResponse.json()
    const remix = aiData.choices?.[0]?.message?.content || ""

    // Generate a short summary of what the source video was actually about
    let transcriptSummary: string | null = null
    if (transcript) {
      try {
        const sumRes = await fetch(`https://ai.gateway.lovable.dev/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You summarise short-form videos for a business owner who wants to remix them. Output STRICT markdown with these sections and nothing else:

**What the video is about:** 1 sentence.

**Tone & vibe:** 1 short phrase (e.g. "blunt and contrarian", "warm storytelling", "punchy listicle").

**Key points:**
- 2 to 4 short bullets covering the actual ideas/claims made.

**Why it works:** 1 sentence on the hook or angle that made it land.

**How it maps to your business:** 1 sentence connecting the idea to: ${businessOverview}.

Keep it tight. No fluff, no preamble.`,
              },
              {
                role: "user",
                content: `Transcript:\n"""\n${transcript}\n"""\n\nOriginal caption: "${postCaption || "(none)"}"`,
              },
            ],
            max_tokens: 400,
          }),
        })
        if (sumRes.ok) {
          const sumData = await sumRes.json()
          transcriptSummary = sumData.choices?.[0]?.message?.content || null
        }
      } catch (e: any) {
        console.log("Summary generation failed:", e?.message)
      }
    }

    return new Response(
      JSON.stringify({ remix, transcribed: !!transcript, transcriptSummary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
