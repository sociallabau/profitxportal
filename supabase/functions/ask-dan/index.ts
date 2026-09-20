// Ask Dan — the client-facing assistant.
//
// Answers in Dan's voice from his teaching material only, and ends with
// concrete next steps and a resource to go and watch. Clients never see where
// an answer came from, and can never reach a 1:1 call or a private message:
// retrieval goes through search_knowledge_public, which is restricted in SQL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_VOICE = `Dan Wilmott runs ProfitX, coaching videographers to build retainer businesses. Write exactly as Dan speaks to a client:
- Direct and warm, Australian, no corporate speak
- Short paragraphs with line breaks, not essays
- Plain words over jargon — explain the thing rather than naming it
- Confident and practical: tell them what to do, don't hedge
- No emoji, and never open with "Great question"`;

function systemPrompt(voice: string, catalogue: string) {
  return `You are Dan Wilmott answering one of his ProfitX clients directly.

HOW DAN WRITES
${voice}

WHAT YOU KNOW
Below you'll be given passages from Dan's own workshops, momentum calls, Q&As and trainings. That is your source of truth for what Dan thinks.

HOW TO ANSWER

1. Give a real answer. The passages are a starting point, not a script — Dan may have covered the idea loosely, in passing, or applied to a different situation. Take his thinking and work it through properly for what this client actually asked. Explain the reasoning, not just the conclusion.

2. Stay inside Dan's thinking. Extend and apply what he believes; never contradict it, and never invent a framework name, a price, a guarantee or a client result he hasn't given. Where he'd give a number, give his reasoning for arriving at one instead of making one up.

3. Write it as a message to that person. Answer them, not the topic.

4. Then give 1 to 3 next steps — only if the question calls for action. Each one concrete enough to do this week: a thing to build, calculate, send or change. Not "think about your pricing". Skip them entirely for a question that just wants an explanation.

5. Then point to one resource from the catalogue below, only if one genuinely fits. Use its exact title. If nothing fits, don't force it.

RESOURCES YOU CAN POINT TO
${catalogue}

RETURN FORMAT
Return only JSON, no markdown fence:
{"answer": "...", "next_steps": ["..."], "resource": "exact title, or null"}

The answer field is what the client reads, so it must stand alone and sound like Dan wrote it.`;
}

async function callModel(prompt: string, system: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    return (await res.json()).content?.[0]?.text ?? "";
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("No AI key configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_tokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    // A reasoning model with no token budget burns it all on thinking and
    // returns empty content, so surface the reason rather than "".
    throw new Error(
      `Gateway returned no content (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"})`,
    );
  }
  return text;
}

/** Models sometimes wrap JSON in a fence or add a sentence around it. */
function parseAnswer(raw: string): { answer: string; next_steps: string[]; resource: string | null } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      answer: String(parsed.answer ?? "").trim(),
      next_steps: Array.isArray(parsed.next_steps)
        ? parsed.next_steps.map((s: unknown) => String(s)).filter(Boolean).slice(0, 3)
        : [],
      resource: parsed.resource ? String(parsed.resource) : null,
    };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return parseAnswer(match[0]);
      } catch { /* fall through */ }
    }
    // Never lose the answer to a formatting problem.
    return { answer: cleaned, next_steps: [], resource: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const scoped = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await scoped.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { question, catalogue } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return json({ error: "Ask a question first" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Exact phrasing, then a ranked any-of pass, then the most distinctive
    // word — the same ladder the admin tool uses, so it always finds material.
    let { data: chunks } = await admin.rpc("search_knowledge_public", {
      q: question, limit_n: 20,
    });

    if (!chunks || chunks.length === 0) {
      const anyOf = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/).filter(w => w.length > 2).join(" or ");
      if (anyOf) {
        const { data } = await admin.rpc("search_knowledge_public", { q: anyOf, limit_n: 20 });
        chunks = data;
      }
    }

    if (!chunks || chunks.length === 0) {
      const longest = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length)[0];
      if (longest) {
        const { data } = await admin.rpc("search_knowledge_public", { q: longest, limit_n: 14 });
        chunks = data;
      }
    }

    if (!chunks || chunks.length === 0) {
      return json({
        answer: "I haven't covered that one yet — drop it in the Q&A chat and Dan will get to it.",
        next_steps: [],
        resource: null,
      });
    }

    const { data: voice } = await admin
      .from("voice_profile").select("content").eq("slug", "default").maybeSingle();

    const context = (chunks as { title: string; content: string }[])
      .map(c => `[From: ${c.title}]\n${c.content}`)
      .join("\n\n---\n\n");

    const system = systemPrompt(
      voice?.content ? `${BASE_VOICE}\n\n${voice.content}` : BASE_VOICE,
      typeof catalogue === "string" && catalogue.trim() ? catalogue.slice(0, 6000) : "(none available)",
    );

    const raw = await callModel(
      `PASSAGES FROM DAN'S TEACHING:\n\n${context}\n\n=====\n\nTHE CLIENT ASKED:\n${question}\n\nAnswer them.`,
      system,
    );

    const result = parseAnswer(raw);
    if (!result.answer) {
      return json({ error: "The model returned an empty answer — try again" }, 502);
    }

    // Logged so Dan can see what his clients keep asking.
    await admin.from("client_questions").insert({
      user_id: userId,
      question: question.trim(),
      answer: result.answer,
      next_steps: result.next_steps,
      resource: result.resource,
    });

    return json(result);
  } catch (err) {
    console.error("ask-dan error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
