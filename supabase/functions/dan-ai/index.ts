// Dan AI — answers a client question using only Dan's own words.
//
// Retrieval is full-text over knowledge_chunks (training transcripts, call
// transcripts, WhatsApp exports), plus any answer Dan has already approved.
// Admin-only: Dan and Emily.
//
// Uses ANTHROPIC_API_KEY when set, otherwise falls back to the Lovable AI
// gateway the other functions already use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Dan Wilmott's writing assistant for ProfitX, a coaching program for videographers building retainer businesses.

Dan or his team member Emily will give you a question a client has asked. Your job is to write the reply Dan would send — so he never has to type the same answer twice.

RULES

1. Answer from the context provided below. It is drawn from Dan's own trainings, coaching calls and messages.

   Always give the closest answer the context supports. If it covers the question directly, answer directly. If it only covers it partly — a related situation, the same principle applied elsewhere — give Dan's closest thinking and keep it general rather than inventing specifics. The person reading your answer can see exactly which calls and trainings it came from, listed beside it, so they can check it before sending.

   Never reply that you cannot answer, and never tell them to add more material. Never invent a framework, price, process or result Dan has not said.

2. Write as Dan writes to a client in a message:
   - Direct and warm, Australian, no corporate speak
   - Short paragraphs and line breaks, not essays
   - Plain words over jargon; explain the thing rather than naming it
   - Confident and practical — tell them what to do next
   - No emoji unless the context shows Dan using them
   - Never open with "Great question"

3. Keep it the length of a real message. A few short paragraphs. Only go longer if the question genuinely needs steps, and then use short bullets.

4. Never mention another client by name, or repeat another client's numbers, revenue or private situation. The context contains real client calls — use the thinking, never the identifying details.

5. Write the reply itself, ready to paste. No preamble, no "here's a draft", no sign-off unless Dan's own messages use one.`;

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callLovable(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Scoped to the caller, so RLS decides what they can read.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_admin) return json({ error: "Admins only" }, 403);

    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return json({ error: "A question is required" }, 400);
    }

    // Postgres full-text ANDs every word together, so a whole question rarely
    // matches a single passage. Try the exact phrasing first, then fall back to
    // a ranked any-of match, which is what actually finds the relevant material.
    const anyOf = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(" or ");

    let [{ data: chunks }, { data: saved }] = await Promise.all([
      supabase.rpc("search_knowledge", { q: question, limit_n: 24 }),
      supabase.rpc("search_saved_answers", { q: question, limit_n: 3 }),
    ]);

    let approximate = false;
    if ((!chunks || chunks.length === 0) && anyOf) {
      approximate = true;
      const [broadChunks, broadSaved] = await Promise.all([
        supabase.rpc("search_knowledge", { q: anyOf, limit_n: 24 }),
        supabase.rpc("search_saved_answers", { q: anyOf, limit_n: 3 }),
      ]);
      chunks = broadChunks.data;
      if (!saved || saved.length === 0) saved = broadSaved.data;
    }

    if ((!chunks || chunks.length === 0) && (!saved || saved.length === 0)) {
      return json({
        answer:
          "The knowledge base is empty, so there is nothing to answer from yet. Add a transcript in the Knowledge tab.",
        sources: [],
        empty: true,
      });
    }

    const contextBlocks = (chunks ?? []).map(
      (c: { title: string; source_type: string; content: string }) =>
        `[${c.source_type} — ${c.title}]\n${c.content}`,
    );

    const approvedBlocks = (saved ?? []).map(
      (s: { question: string; answer: string }) =>
        `[Dan already approved this answer]\nQ: ${s.question}\nA: ${s.answer}`,
    );

    const prompt = [
      approvedBlocks.length
        ? `ANSWERS DAN HAS ALREADY APPROVED — if one of these fits, reuse its wording almost exactly:\n\n${approvedBlocks.join("\n\n")}`
        : "",
      `CONTEXT FROM DAN'S OWN TRAININGS, CALLS AND MESSAGES:\n\n${contextBlocks.join("\n\n---\n\n")}`,
      approximate
        ? `THE CLIENT ASKED:\n${question}\n\nThe context above is the closest material in Dan's knowledge base — it may not address this exact question. Give the closest answer his thinking supports, in his voice. Do not mention that the match was approximate.`
        : `THE CLIENT ASKED:\n${question}\n\nWrite Dan's reply.`,
    ]
      .filter(Boolean)
      .join("\n\n=====\n\n");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    let answer: string;
    let model: string;
    if (anthropicKey) {
      answer = await callAnthropic(anthropicKey, prompt);
      model = "claude-sonnet-5";
    } else if (lovableKey) {
      answer = await callLovable(lovableKey, prompt);
      model = "gemini-2.5-pro";
    } else {
      return json({ error: "No AI key configured" }, 500);
    }

    const sources = (chunks ?? []).slice(0, 6).map(
      (c: { title: string; source_type: string; content: string }) => ({
        title: c.title,
        source_type: c.source_type,
        snippet: c.content.slice(0, 220),
      }),
    );

    return json({
      answer,
      sources,
      model,
      approximate,
      reusedApproved: (saved ?? []).length > 0,
    });
  } catch (err) {
    console.error("dan-ai error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
