import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { handle, dmHistory, prospectReply, offerSummary } = body ?? {};
    if (!prospectReply || typeof prospectReply !== "string" || prospectReply.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid prospectReply" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyText = Array.isArray(dmHistory)
      ? dmHistory.slice(-8).map((m: any) => `${m.role === "me" ? "Me" : "Prospect"}: ${m.text}`).join("\n")
      : "";

    const systemPrompt = `You are a top-tier Instagram DM closer for videographers selling monthly retainers. Your goal: keep the conversation natural, build rapport, and move toward booking a 15-minute call. Never sound salesy or scripted. Match the prospect's energy and length. Use lowercase casual tone, max 2 short paragraphs. Never use emojis more than 1 per message. Always end with a soft question or low-friction next step.`;

    const userPrompt = `Prospect IG handle: @${handle ?? "unknown"}
${offerSummary ? `My offer: ${offerSummary}\n` : ""}
Recent DM history:
${historyText || "(none yet)"}

Prospect just replied:
"${prospectReply}"

Generate 3 distinct next-message options I could send. Vary the angle (e.g. one curious, one value-led, one direct). Each should sound like a real human typing on their phone.`;

    // Claude first. It uses a tool call for the same structured output the
    // gateway path produces, so the response shape is identical either way.
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
            max_tokens: 1200,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            tools: [{
              name: "suggest_replies",
              description: "Return 3 candidate DM replies",
              input_schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        angle: { type: "string", description: "1-3 word label e.g. 'Curious'" },
                        message: { type: "string" },
                      },
                      required: ["angle", "message"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            }],
            tool_choice: { type: "tool", name: "suggest_replies" },
          }),
        });

        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

        const data = await res.json();
        const toolUse = data.content?.find((block: { type: string }) => block.type === "tool_use");
        const suggestions = toolUse?.input?.suggestions;
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          throw new Error("Claude returned no suggestions");
        }

        return new Response(JSON.stringify({ suggestions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        // Fall through to the gateway rather than failing the request.
        if (!LOVABLE_API_KEY) throw err;
        console.error("Claude call failed, falling back to the gateway:", err);
      }
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_replies",
            description: "Return 3 candidate DM replies",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      angle: { type: "string", description: "1-3 word label e.g. 'Curious'" },
                      message: { type: "string" },
                    },
                    required: ["angle", "message"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit hit, try again in a moment" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted — top up in Settings" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { suggestions: [] };

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dm-reply-suggester error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
