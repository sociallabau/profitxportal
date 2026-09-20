// Works out what Dan's clients actually keep asking, and stores the top few as
// prompts for the Ask Dan page.
//
// Two signals: the questions clients ask out loud in Q&As and momentum calls,
// and what they have already typed into Ask Dan. The second gets more useful
// the longer the tool is in use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTRUCTION = `Below are transcripts of Dan Wilmott running Q&A calls, momentum calls and workshops for ProfitX — coaching videographers to build retainer businesses. Clients ask him questions throughout.

Work out the five questions his clients ask most often. Not the five most interesting — the five that come up again and again, in different words, from different people.

Rules for each one:
- Phrase it the way a client would actually type it, first person, casual. "How much should I charge for a retainer?" not "Retainer pricing methodology".
- Keep it under 90 characters so it fits on a button.
- Make each one distinctly different. Five angles on pricing is a failure.
- Base it on what is actually asked in the transcripts, not what you assume a videographer would ask.

Return only JSON, no markdown fence:
[{"question": "...", "theme": "one or two words"}, ...]`;

async function callModel(prompt: string): Promise<string> {
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
        max_tokens: 1200,
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
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Lovable gateway ${res.status}: ${await res.text()}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
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
    const { data: profile } = await scoped
      .from("profiles").select("is_admin").eq("id", userData.user.id).single();
    if (!profile?.is_admin) return json({ error: "Admins only" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Q&As and momentum calls are where clients actually ask things out loud.
    const { data: docs } = await admin
      .from("knowledge_docs")
      .select("id, title")
      .eq("source_type", "teaching")
      .limit(40);

    if (!docs?.length) {
      return json({ error: "No workshop or Q&A transcripts in the knowledge base yet" }, 400);
    }

    const { data: chunks } = await admin
      .from("knowledge_chunks")
      .select("content")
      .in("doc_id", docs.map(d => d.id))
      .limit(120);

    if (!chunks?.length) {
      return json({ error: "No transcript content to read yet" }, 400);
    }

    // What clients have already typed in, if there is any history.
    const { data: asked } = await admin
      .from("client_questions")
      .select("question")
      .order("created_at", { ascending: false })
      .limit(200);

    const alreadyAsked = asked?.length
      ? `\n\n=====\n\nQUESTIONS CLIENTS HAVE ALREADY TYPED INTO THE PORTAL (weight these heavily — they are real):\n${asked.map(a => `- ${a.question}`).join("\n")}`
      : "";

    const corpus = chunks.map(c => c.content).join("\n\n---\n\n").slice(0, 170_000);
    const raw = await callModel(`${INSTRUCTION}\n\n=====\n\nTRANSCRIPTS:\n\n${corpus}${alreadyAsked}`);

    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { question: string; theme?: string }[];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) return json({ error: "Could not read the model's answer — try again" }, 502);
      parsed = JSON.parse(match[0]);
    }

    const questions = (Array.isArray(parsed) ? parsed : [])
      .filter(q => q && typeof q.question === "string" && q.question.trim())
      .slice(0, 5)
      .map((q, i) => ({
        question: q.question.trim().slice(0, 140),
        theme: q.theme ? String(q.theme).slice(0, 40) : null,
        position: i,
      }));

    if (!questions.length) return json({ error: "The model returned no questions" }, 502);

    // Replace wholesale so the list always reflects the latest read.
    await admin.from("suggested_questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await admin.from("suggested_questions").insert(questions);
    if (error) throw error;

    return json({ questions, read_from: docs.length, from_portal: asked?.length ?? 0 });
  } catch (err) {
    console.error("common-questions error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
