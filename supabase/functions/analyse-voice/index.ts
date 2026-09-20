// Builds a written profile of how Dan talks and writes, from his own material.
//
// Run from the admin panel. The result is injected into every client-facing
// answer, which is how a client gets Dan's voice without any private message
// of his ever being sent to them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTRUCTION = `Below are samples of how Dan Wilmott actually writes and speaks — messages he has typed to clients, and transcripts of him teaching.

Write a style guide a writer could follow to be mistaken for him. Be specific and observational, not flattering. Cover:

- Sentence length and rhythm. Does he run on, or clip short?
- The words and phrases he reaches for repeatedly. Quote them.
- How he opens a reply, and how he closes one.
- How he handles disagreement or bad news.
- How he explains something technical to someone who is behind.
- Punctuation and formatting habits: dashes, line breaks, capitals, lists.
- Australian idiom and slang he uses, and how often.
- What he never does — the tells that would give away an impostor.

Be concrete. "Uses short sentences" is useless; "Breaks after one idea, often a three-to-six word line on its own" is useful. Quote him directly wherever you can.

Quote Dan only. The samples include calls with individual clients, so never carry a client's name, business, revenue or personal situation into the guide — you are describing how he speaks, not what was discussed.

Return the guide as plain text, no preamble, under 900 words.`;

async function callModel(prompt: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const text = (await res.json()).content?.[0]?.text ?? "";
      if (!text) throw new Error("Claude returned no content");
      return text;
    } catch (err) {
      // Keep working if Claude is unreachable or out of credit, rather
      // than taking the whole feature down with it.
      if (!Deno.env.get("LOVABLE_API_KEY")) throw err;
      console.error("Claude call failed, falling back to the gateway:", err);
    }
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("No AI key configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
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

    // Everything in the knowledge base that is actually Dan speaking or
    // writing. Each register is sampled separately so one big source cannot
    // drown the others:
    //   whatsapp   - how he types, the closest match to a written answer
    //   call       - 1:1s, him talking to one person rather than a room
    //   teaching   - workshops, Q&As, momentum calls
    //   transcript - his own trainings and uploads
    // Gemini notes are excluded on purpose: they are written *about* him in
    // third person ("Dan advised..."), so they would teach the wrong voice.
    const REGISTERS: { type: string; label: string; docs: number; chunks: number }[] = [
      { type: "whatsapp", label: "Dan, typed to a client", docs: 60, chunks: 70 },
      { type: "call", label: "Dan, on a 1:1 call", docs: 60, chunks: 60 },
      { type: "teaching", label: "Dan, teaching a group", docs: 60, chunks: 60 },
      { type: "transcript", label: "Dan, in his own training", docs: 40, chunks: 40 },
    ];

    const samples: string[] = [];

    for (const register of REGISTERS) {
      const { data: docs } = await admin
        .from("knowledge_docs").select("id").eq("source_type", register.type).limit(register.docs);
      const ids = (docs ?? []).map(d => d.id);
      if (!ids.length) continue;

      const { data } = await admin
        .from("knowledge_chunks").select("content").in("doc_id", ids).limit(register.chunks);
      for (const c of data ?? []) samples.push(`[${register.label}]\n${c.content}`);
    }

    if (!samples.length) {
      return json({ error: "Nothing in the knowledge base to analyse yet" }, 400);
    }

    // Keep the prompt inside a sensible size.
    const corpus = samples.join("\n\n---\n\n").slice(0, 320_000);
    const content = (await callModel(`${INSTRUCTION}\n\n=====\n\n${corpus}`)).trim();

    if (!content) return json({ error: "The model returned nothing — try again" }, 502);

    const { error } = await admin.from("voice_profile").upsert({
      slug: "default",
      content,
      built_from: samples.length,
      updated_at: new Date().toISOString(),
      updated_by: userData.user.id,
    }, { onConflict: "slug" });

    if (error) throw error;

    return json({ content, built_from: samples.length });
  } catch (err) {
    console.error("analyse-voice error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
